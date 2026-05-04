"""
Document Ingestion Pipeline
============================
Ingests documents from HotpotQA or custom sources into TigerGraph.
"""
import hashlib
import json
import logging
from typing import Dict, List, Tuple
from .layers.graph_layer import GraphLayer, chunk_text, generate_entity_id, generate_chunk_id
from .layers.llm_layer import LLMLayer
from .layers.orchestration_layer import EmbeddingManager

logger = logging.getLogger(__name__)


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
        for i, (chunk, emb) in enumerate(zip(chunks, embs)):
            cid = generate_chunk_id(doc_id, i)
            self.graph.upsert_chunk(cid, chunk, emb, i, len(chunk.split()), doc_id)
            self.stats["chunks"] += 1
            if extract_entities:
                self._extract_entities(cid, chunk)
        return self.stats

    def _extract_entities(self, chunk_id, text):
        """Extract entities from chunk and upsert to graph."""
        try:
            resp = self.llm.extract_entities(text)
            content = resp.content
            start = content.find("{")
            end = content.rfind("}") + 1
            if start == -1 or end == 0:
                raise ValueError("No JSON found")
            raw = content[start:end]
            try:
                data = json.loads(raw)
            except Exception:
                from json_repair import repair_json
                data = json.loads(repair_json(raw))
        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
            self.stats["errors"] += 1
            return

        name_to_id = {}
        for ent in data.get("entities", []):
            name = ent.get("name", "").strip()
            etype = ent.get("type", "CONCEPT").strip()
            if not name:
                continue
            eid = generate_entity_id(name, etype)
            name_to_id[name] = eid
            emb = self.embedder.embed_single(f"{name} ({etype}): {ent.get('description', '')}")
            self.graph.upsert_entity(eid, name, etype, ent.get("description", ""), emb)
            self.graph.upsert_mention(chunk_id, eid)
            self.stats["entities"] += 1
            self.stats["mentions"] += 1

        for rel in data.get("relations", []):
            sid = name_to_id.get(rel.get("source", ""))
            tid = name_to_id.get(rel.get("target", ""))
            if sid and tid:
                self.graph.upsert_relation(sid, tid, rel.get("type", "RELATED_TO"),
                                           rel.get("description", ""))
                self.stats["relations"] += 1

    def ingest_hotpotqa(self, max_docs=100, split="validation", extract_entities=True):
        """Ingest HotpotQA documents into the graph."""
        from datasets import load_dataset
        logger.info(f"Loading HotpotQA ({split}, max={max_docs})...")
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
                    logger.info(f"Ingested {ingested}/{max_docs} documents...")
        logger.info(f"Ingestion complete. Stats: {self.stats}")
        return self.stats

    def ingest_custom_documents(self, documents: List[Dict], extract_entities=True):
        """Ingest custom documents. Each dict: {id, title, content, source}."""
        import gc
        total = len(documents)
        for i, doc in enumerate(documents, 1):
            try:
                self.ingest_document(
                    doc_id=doc.get("id", hashlib.md5(doc["title"].encode()).hexdigest()[:10]),
                    title=doc.get("title", ""), content=doc.get("content", ""),
                    source=doc.get("source", "custom"), extract_entities=extract_entities)
                logger.info(f"Ingested {i}/{total}: {doc.get('title', '')[:60]}")
            except MemoryError:
                logger.warning(f"Skipped {i}/{total} (MemoryError): {doc.get('title', '')[:60]}")
                self.stats["errors"] += 1
            gc.collect()
        return self.stats
