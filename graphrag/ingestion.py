"""
Document Ingestion Pipeline
============================
Ingests documents from HotpotQA or custom sources into TigerGraph.
"""
import hashlib
import json
import logging
from typing import Dict, List
from .layers.graph_layer import chunk_text, generate_entity_id, generate_chunk_id
from .layers.orchestration_layer import EmbeddingManager  # noqa: F401 – re-exported for callers

logger = logging.getLogger(__name__)

# Optional JSON repair — graceful degradation if not installed
try:
    from json_repair import repair_json as _repair_json  # type: ignore[import]
    _HAS_JSON_REPAIR = True
except ImportError:
    _HAS_JSON_REPAIR = False

_VALID_ENTITY_TYPES = {
    "PERSON", "ORGANIZATION", "LOCATION", "CONCEPT",
    "WORK", "EVENT", "PRODUCT", "PROCESS", "OTHER",
}


class IngestionPipeline:
    """Full document ingestion: Docs → Chunks → Embeddings → Entities → Graph."""

    def __init__(self, graph, llm, embedder, config=None):
        self.graph = graph
        self.llm = llm
        self.embedder = embedder
        self.config = config or {}
        self.stats = {"documents": 0, "chunks": 0, "entities": 0,
                      "relations": 0, "mentions": 0, "errors": 0}

    def ingest_document(self, doc_id, title, content, source="", extract_entities=True):
        """Ingest a single document into the graph."""
        content = content[:20000]  # cap at ~4k tokens to prevent MemoryError
        self.graph.upsert_document(doc_id, title, content, source)
        self.stats["documents"] += 1

        chunks = chunk_text(content, self.config.get("chunk_size", 1000),
                            self.config.get("chunk_overlap", 100))
        if not chunks:
            return self.stats

        embs = self.embedder.embed(chunks)
        chunk_ids: List[str] = []
        for i, (chunk, emb) in enumerate(zip(chunks, embs)):
            cid = generate_chunk_id(doc_id, i)
            self.graph.upsert_chunk(cid, chunk, emb, i, len(chunk.split()), doc_id)
            self.stats["chunks"] += 1
            chunk_ids.append(cid)

        # One LLM call per document instead of one per chunk (~20× fewer calls)
        if extract_entities and chunk_ids:
            self._extract_entities_for_doc(chunk_ids, chunks, content)

        return self.stats

    def _extract_entities_for_doc(self, chunk_ids: List[str], chunks: List[str], doc_text: str):
        """Extract entities once for the whole document; link each entity to
        every chunk whose text contains the entity name."""
        try:
            resp = self.llm.extract_entities(doc_text)
            raw_content = resp.content
            start = raw_content.find("{")
            end = raw_content.rfind("}") + 1
            if start == -1 or end == 0:
                raise ValueError("No JSON object found in LLM response")
            raw = raw_content[start:end]
            try:
                data = json.loads(raw)
            except Exception:
                if _HAS_JSON_REPAIR:
                    data = json.loads(_repair_json(raw))
                else:
                    raise ValueError(
                        "Invalid JSON in LLM response; install json_repair for auto-repair"
                    )
        except Exception as e:
            logger.error("Entity extraction failed for doc: %s", e)
            self.stats["errors"] += 1
            return

        name_to_id: Dict[str, str] = {}
        for ent in data.get("entities", []):
            name = ent.get("name", "").strip()
            etype = ent.get("type", "CONCEPT").strip().upper()
            if not name:
                continue
            # Clamp to known schema types to prevent TigerGraph schema violations
            if etype not in _VALID_ENTITY_TYPES:
                etype = "CONCEPT"
            eid = generate_entity_id(name, etype)
            name_to_id[name] = eid
            emb = self.embedder.embed_single(
                f"{name} ({etype}): {ent.get('description', '')}"
            )
            self.graph.upsert_entity(eid, name, etype, ent.get("description", ""), emb)
            self.stats["entities"] += 1

            # Link entity only to chunks that actually mention it by name
            name_lower = name.lower()
            for cid, chunk_text_content in zip(chunk_ids, chunks):
                if name_lower in chunk_text_content.lower():
                    self.graph.upsert_mention(cid, eid)
                    self.stats["mentions"] += 1

        for rel in data.get("relations", []):
            sid = name_to_id.get(rel.get("source", ""))
            tid = name_to_id.get(rel.get("target", ""))
            if sid and tid:
                self.graph.upsert_relation(
                    sid, tid,
                    rel.get("type", "RELATED_TO"),
                    rel.get("description", ""),
                )
                self.stats["relations"] += 1

    def ingest_hotpotqa(self, max_docs=100, split="validation", extract_entities=True):
        """Ingest HotpotQA documents into the graph."""
        from datasets import load_dataset  # type: ignore[import]
        logger.info("Loading HotpotQA (%s, max=%d)...", split, max_docs)
        ds = load_dataset("hotpotqa/hotpot_qa", "distractor", split=split)
        ingested, seen = 0, set()
        for row in ds:
            if ingested >= max_docs:
                break
            for title, sents in zip(row["context"]["title"], row["context"]["sentences"]):
                if title in seen or ingested >= max_docs:
                    continue
                seen.add(title)
                content = " ".join(sents)
                if len(content) < 50:
                    continue
                did = hashlib.md5(title.encode()).hexdigest()[:10]
                self.ingest_document(did, title, content, "hotpotqa", extract_entities)
                ingested += 1
                if ingested % 10 == 0:
                    logger.info("Ingested %d/%d documents...", ingested, max_docs)
        logger.info("Ingestion complete. Stats: %s", self.stats)
        return self.stats

    def ingest_custom_documents(self, documents: List[Dict], extract_entities=True):
        """Ingest custom documents. Each dict: {id, title, content, source}."""
        import gc
        total = len(documents)
        for i, doc in enumerate(documents, 1):
            try:
                title = doc.get("title", "")
                content = doc.get("content", "")
                # Use id → title hash → title+content hash to avoid collisions
                doc_id = (
                    doc.get("id")
                    or (hashlib.md5(title.encode()).hexdigest()[:10] if title else None)
                    or hashlib.md5((title + content[:200]).encode()).hexdigest()[:10]
                )
                self.ingest_document(
                    doc_id=doc_id,
                    title=title,
                    content=content,
                    source=doc.get("source", "custom"),
                    extract_entities=extract_entities,
                )
                logger.info("Ingested %d/%d: %s", i, total, title[:60])
            except Exception as e:
                logger.warning(
                    "Skipped %d/%d (%s): %s — %s",
                    i, total, type(e).__name__, doc.get("title", "")[:60], e,
                )
                self.stats["errors"] += 1
            gc.collect()
        return self.stats
