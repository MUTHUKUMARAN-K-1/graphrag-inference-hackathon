"""
Layer 1: Graph Layer — TigerGraph Schema, Connection, and GSQL Queries
======================================================================
Handles all graph database operations: schema creation, data upsert,
vector search, and multi-hop graph traversal.
"""
import hashlib
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── GSQL Schema Definition ───────────────────────────────
SCHEMA_DDL = """
USE GRAPH {graphname}

CREATE VERTEX Document (PRIMARY_ID doc_id STRING, title STRING, content STRING, source STRING) WITH primary_id_as_attribute="true"
CREATE VERTEX Chunk (PRIMARY_ID chunk_id STRING, text STRING, embedding LIST<DOUBLE>, chunk_index INT, token_count INT, doc_id STRING) WITH primary_id_as_attribute="true"
CREATE VERTEX Entity (PRIMARY_ID entity_id STRING, name STRING, entity_type STRING, description STRING, embedding LIST<DOUBLE>, mention_count INT DEFAULT 1) WITH primary_id_as_attribute="true"
CREATE VERTEX Community (PRIMARY_ID community_id STRING, summary STRING, level INT DEFAULT 0, entity_count INT DEFAULT 0) WITH primary_id_as_attribute="true"

CREATE DIRECTED EDGE PART_OF (FROM Chunk, TO Document, position INT)
CREATE DIRECTED EDGE MENTIONS (FROM Chunk, TO Entity, mention_count INT DEFAULT 1, confidence FLOAT DEFAULT 1.0)
CREATE UNDIRECTED EDGE RELATED_TO (FROM Entity, TO Entity, relation_type STRING, weight FLOAT DEFAULT 1.0, description STRING, keywords STRING)
CREATE DIRECTED EDGE IN_COMMUNITY (FROM Entity, TO Community)
"""

# ── GSQL Installed Queries ────────────────────────────────
VECTOR_SEARCH_QUERY = """
CREATE OR REPLACE QUERY vectorSearchChunks(LIST<DOUBLE> queryVec, INT topK) FOR GRAPH {graphname} {{
    TYPEDEF TUPLE<STRING chunk_id, STRING text, DOUBLE score> ChunkScore;
    HeapAccum<ChunkScore>(topK, score DESC) @@topChunks;
    allChunks = {{Chunk.*}};
    allChunks = SELECT c FROM allChunks:c WHERE c.embedding.size() > 0
        ACCUM
            DOUBLE dotProduct = 0.0, DOUBLE normA = 0.0, DOUBLE normB = 0.0,
            FOREACH i IN RANGE[0, c.embedding.size() - 1] DO
                dotProduct = dotProduct + queryVec.get(i) * c.embedding.get(i),
                normA = normA + queryVec.get(i) * queryVec.get(i),
                normB = normB + c.embedding.get(i) * c.embedding.get(i)
            END,
            DOUBLE sim = CASE WHEN sqrt(normA) * sqrt(normB) > 0 THEN dotProduct / (sqrt(normA) * sqrt(normB)) ELSE 0.0 END,
            @@topChunks += ChunkScore(c.chunk_id, c.text, sim);
    PRINT @@topChunks;
}}
INSTALL QUERY vectorSearchChunks
"""

ENTITY_VECTOR_SEARCH_QUERY = """
CREATE OR REPLACE QUERY vectorSearchEntities(LIST<DOUBLE> queryVec, INT topK) FOR GRAPH {graphname} {{
    TYPEDEF TUPLE<STRING entity_id, STRING name, STRING entity_type, STRING description, DOUBLE score> EntityScore;
    HeapAccum<EntityScore>(topK, score DESC) @@topEntities;
    allEntities = {{Entity.*}};
    allEntities = SELECT e FROM allEntities:e WHERE e.embedding.size() > 0
        ACCUM
            DOUBLE dotProduct = 0.0, DOUBLE normA = 0.0, DOUBLE normB = 0.0,
            FOREACH i IN RANGE[0, e.embedding.size() - 1] DO
                dotProduct = dotProduct + queryVec.get(i) * e.embedding.get(i),
                normA = normA + queryVec.get(i) * queryVec.get(i),
                normB = normB + e.embedding.get(i) * e.embedding.get(i)
            END,
            DOUBLE sim = CASE WHEN sqrt(normA) * sqrt(normB) > 0 THEN dotProduct / (sqrt(normA) * sqrt(normB)) ELSE 0.0 END,
            @@topEntities += EntityScore(e.entity_id, e.name, e.entity_type, e.description, sim);
    PRINT @@topEntities;
}}
INSTALL QUERY vectorSearchEntities
"""

GRAPHRAG_TRAVERSE_QUERY = """
CREATE OR REPLACE QUERY graphRAGTraverse(SET<STRING> seedEntityIds, INT hops) FOR GRAPH {graphname} {{
    SetAccum<STRING> @@visitedEntityIds;
    SetAccum<STRING> @@relevantChunkIds;
    ListAccum<STRING> @@chunkTexts;
    SetAccum<STRING> @@relationDescriptions;

    Seeds = {{Entity.*}};
    Seeds = SELECT e FROM Seeds:e WHERE e.entity_id IN seedEntityIds
        ACCUM @@visitedEntityIds += e.entity_id;

    FOREACH hop IN RANGE[1, hops] DO
        Seeds = SELECT nbr FROM Seeds:e -(RELATED_TO:rel)- Entity:nbr
            WHERE nbr.entity_id NOT IN @@visitedEntityIds
            ACCUM @@visitedEntityIds += nbr.entity_id,
                  @@relationDescriptions += (e.name + " -[" + rel.relation_type + "]-> " + nbr.name + ": " + rel.description);
    END;

    AllVisited = {{Entity.*}};
    AllVisited = SELECT e FROM AllVisited:e WHERE e.entity_id IN @@visitedEntityIds;

    Chunks = SELECT c FROM AllVisited:e -(MENTIONS>:m)- Chunk:c
        ACCUM @@relevantChunkIds += c.chunk_id, @@chunkTexts += c.text;

    PRINT @@visitedEntityIds;
    PRINT @@relevantChunkIds;
    PRINT @@chunkTexts;
    PRINT @@relationDescriptions;
    PRINT AllVisited [AllVisited.name, AllVisited.entity_type, AllVisited.description];
}}
INSTALL QUERY graphRAGTraverse
"""


class GraphLayer:
    """Layer 1: TigerGraph Graph Layer — connection, schema, upserts, retrieval."""

    def __init__(self, config=None):
        self.config = config
        self.conn = None
        self._connected = False

    def connect(self) -> bool:
        """Establish connection to TigerGraph Cloud."""
        try:
            import pyTigerGraph as tg
            cfg = self.config or {}
            self.conn = tg.TigerGraphConnection(
                host=cfg.get("host", ""),
                graphname=cfg.get("graphname", "GraphRAG"),
                username=cfg.get("username", "tigergraph"),
                password=cfg.get("password", ""),
            )
            if cfg.get("token"):
                self.conn.apiToken = cfg["token"]
            else:
                secret = self.conn.createSecret()
                self.conn.getToken(secret)
            self._connected = True
            logger.info("Connected to TigerGraph Cloud successfully.")
            return True
        except Exception as e:
            logger.error(f"TigerGraph connection failed: {e}")
            return False

    def create_schema(self) -> str:
        gn = (self.config or {}).get("graphname", "GraphRAG")
        return self.conn.gsql(SCHEMA_DDL.format(graphname=gn))

    def install_queries(self) -> Dict[str, str]:
        gn = (self.config or {}).get("graphname", "GraphRAG")
        results = {}
        for name, q in [("vectorSearchChunks", VECTOR_SEARCH_QUERY),
                         ("vectorSearchEntities", ENTITY_VECTOR_SEARCH_QUERY),
                         ("graphRAGTraverse", GRAPHRAG_TRAVERSE_QUERY)]:
            try:
                results[name] = self.conn.gsql(q.format(graphname=gn))
            except Exception as e:
                results[name] = str(e)
        return results

    # ── Data Upsert ───────────────────────────────────────

    def upsert_document(self, doc_id, title, content, source=""):
        self.conn.upsertVertex("Document", doc_id, {"title": title, "content": content, "source": source})

    def upsert_chunk(self, chunk_id, text, embedding, chunk_index, token_count, doc_id):
        self.conn.upsertVertex("Chunk", chunk_id, {"text": text, "embedding": embedding,
                                                     "chunk_index": chunk_index, "token_count": token_count, "doc_id": doc_id})
        self.conn.upsertEdge("Chunk", chunk_id, "PART_OF", "Document", doc_id, {"position": chunk_index})

    def upsert_entity(self, entity_id, name, entity_type, description, embedding):
        self.conn.upsertVertex("Entity", entity_id, {"name": name, "entity_type": entity_type,
                                                       "description": description, "embedding": embedding})

    def upsert_mention(self, chunk_id, entity_id, count=1, confidence=1.0):
        self.conn.upsertEdge("Chunk", chunk_id, "MENTIONS", "Entity", entity_id,
                             {"mention_count": count, "confidence": confidence})

    def upsert_relation(self, src_id, tgt_id, rtype, desc="", weight=1.0, keywords=""):
        self.conn.upsertEdge("Entity", src_id, "RELATED_TO", "Entity", tgt_id,
                             {"relation_type": rtype, "description": desc, "weight": weight, "keywords": keywords})

    # ── Retrieval ─────────────────────────────────────────

    def vector_search_chunks(self, query_embedding, top_k=5):
        try:
            result = self.conn.runInstalledQuery("vectorSearchChunks",
                                                  params={"queryVec": query_embedding, "topK": top_k})
            return result[0].get("@@topChunks", []) if result else []
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    def vector_search_entities(self, query_embedding, top_k=5):
        try:
            result = self.conn.runInstalledQuery("vectorSearchEntities",
                                                  params={"queryVec": query_embedding, "topK": top_k})
            return result[0].get("@@topEntities", []) if result else []
        except Exception as e:
            logger.error(f"Entity search failed: {e}")
            return []

    def graph_traverse(self, seed_entity_ids, hops=2):
        try:
            result = self.conn.runInstalledQuery("graphRAGTraverse",
                                                  params={"seedEntityIds": seed_entity_ids, "hops": hops})
            parsed = {"entity_ids": [], "chunk_ids": [], "chunk_texts": [], "relations": [], "entities": []}
            if result:
                for r in result:
                    if "@@visitedEntityIds" in r: parsed["entity_ids"] = list(r["@@visitedEntityIds"])
                    if "@@relevantChunkIds" in r: parsed["chunk_ids"] = list(r["@@relevantChunkIds"])
                    if "@@chunkTexts" in r: parsed["chunk_texts"] = r["@@chunkTexts"]
                    if "@@relationDescriptions" in r: parsed["relations"] = list(r["@@relationDescriptions"])
                    if "AllVisited" in r: parsed["entities"] = r["AllVisited"]
            return parsed
        except Exception as e:
            logger.error(f"Traversal failed: {e}")
            return {"entity_ids": [], "chunk_ids": [], "chunk_texts": [], "relations": [], "entities": []}

    @property
    def is_connected(self):
        return self._connected


# ── Utility Functions ──────────────────────────────────────

def generate_entity_id(name: str, entity_type: str) -> str:
    """Generate deterministic entity ID for deduplication."""
    raw = f"{name.lower().strip()}:{entity_type.lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]

def generate_chunk_id(doc_id: str, chunk_index: int) -> str:
    return f"{doc_id}_chunk_{chunk_index:04d}"

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100) -> List[str]:
    """Split text into overlapping chunks with sentence boundary detection."""
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            for sep in ['. ', '.\n', '\n\n', '\n', ' ']:
                last_sep = text[start:end].rfind(sep)
                if last_sep > chunk_size * 0.5:
                    end = start + last_sep + len(sep)
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap
        if start >= len(text):
            break
    return chunks

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    na = math.sqrt(sum(a * a for a in vec_a))
    nb = math.sqrt(sum(b * b for b in vec_b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
