"""
TigerGraph GraphRAG Client — Integration with the Official tigergraph/graphrag Repo
====================================================================================
This module integrates with the official TigerGraph GraphRAG service
(https://github.com/tigergraph/graphrag) deployed via Docker.

The official repo exposes REST APIs for graph-powered Q&A with three retrievers:
  - Hybrid Search: vector similarity + graph traversal combined
  - Community: hierarchical community summaries (Leiden algorithm)
  - Sibling: sibling/neighbor node traversal from seed entities

This client calls those APIs. When the official service is not available,
it falls back to our custom pyTigerGraph-based GraphLayer implementation.

Usage:
    client = TGGraphRAGClient(service_url="http://localhost:8000", ...)
    if client.connect():
        result = client.retrieve(query, retriever="hybrid", top_k=5, num_hops=2)
        answer = client.query(question, retriever="hybrid")
"""

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class RetrievalResult:
    """Result from a TG GraphRAG retrieval call."""
    content: str = ""
    chunks: List[Dict[str, Any]] = field(default_factory=list)
    entities: List[Dict[str, Any]] = field(default_factory=list)
    relations: List[str] = field(default_factory=list)
    community_summaries: List[str] = field(default_factory=list)
    retriever_used: str = ""
    score: float = 0.0
    latency_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GraphRAGAnswer:
    """Full answer from the TG GraphRAG service."""
    answer: str = ""
    retrieval: RetrievalResult = field(default_factory=RetrievalResult)
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0


class TGGraphRAGClient:
    """
    Client for the official TigerGraph GraphRAG service.

    Supports two modes:
      1. REST API mode: calls the deployed tigergraph/graphrag Docker service
      2. Direct mode: uses pyTigerGraph SDK with our custom GSQL queries (fallback)

    The hackathon allows both Path A (use as-is) and Path B (customize).
    This client implements Path A (REST API) with Path B fallback (direct GSQL).
    """

    def __init__(
        self,
        service_url: str = "",
        tg_host: str = "",
        tg_graph: str = "GraphRAG",
        tg_username: str = "tigergraph",
        tg_password: str = "",
        tg_token: str = "",
    ):
        self.service_url = (
            service_url
            or os.getenv("GRAPHRAG_SERVICE_URL", "")
            or os.getenv("TG_GRAPHRAG_URL", "")
        ).rstrip("/")
        self.tg_host = tg_host or os.getenv("TG_HOST", "")
        self.tg_graph = tg_graph or os.getenv("TG_GRAPH", "GraphRAG")
        self.tg_username = tg_username or os.getenv("TG_USERNAME", "tigergraph")
        self.tg_password = tg_password or os.getenv("TG_PASSWORD", "")
        self.tg_token = tg_token or os.getenv("TG_TOKEN", "")

        self._service_available = False
        self._direct_available = False
        self._conn = None
        self._api_token = ""
        self._openapi_spec: Dict = {}

    # ── Connection ────────────────────────────────────────

    def connect(self) -> bool:
        """
        Connect to the TG GraphRAG service.
        Tries REST API first, then falls back to direct pyTigerGraph.
        """
        # Try REST API service first
        if self.service_url:
            self._service_available = self._check_service()
            if self._service_available:
                logger.info(f"Connected to TG GraphRAG service at {self.service_url}")
                self._discover_endpoints()
                return True

        # Fall back to direct pyTigerGraph connection
        if self.tg_host:
            self._direct_available = self._connect_direct()
            if self._direct_available:
                logger.info(f"Connected to TigerGraph directly at {self.tg_host}")
                return True

        logger.warning("No TG GraphRAG connection available. Running in offline mode.")
        return False

    def _check_service(self) -> bool:
        """Check if the TG GraphRAG REST service is healthy."""
        import urllib.request
        import urllib.error

        # Try common health endpoints
        for path in ["/health", "/api/health", "/", "/docs", "/openapi.json"]:
            try:
                url = f"{self.service_url}{path}"
                req = urllib.request.Request(url, method="GET")
                if self._api_token:
                    req.add_header("Authorization", f"Bearer {self._api_token}")
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        logger.info(f"TG GraphRAG service healthy at {url}")
                        return True
            except (urllib.error.URLError, OSError):
                continue
        return False

    def _discover_endpoints(self):
        """Discover available API endpoints from OpenAPI spec."""
        import urllib.request
        try:
            url = f"{self.service_url}/openapi.json"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                self._openapi_spec = json.loads(resp.read())
                paths = list(self._openapi_spec.get("paths", {}).keys())
                logger.info(f"Discovered {len(paths)} API endpoints: {paths[:10]}")
        except Exception as e:
            logger.debug(f"Could not discover endpoints: {e}")

    def _connect_direct(self) -> bool:
        """Connect directly to TigerGraph via pyTigerGraph."""
        try:
            import pyTigerGraph as tg
            self._conn = tg.TigerGraphConnection(
                host=self.tg_host,
                graphname=self.tg_graph,
                username=self.tg_username,
                password=self.tg_password,
            )
            if self.tg_token:
                self._conn.apiToken = self.tg_token
            else:
                secret = self._conn.createSecret()
                self._conn.getToken(secret)
            return True
        except Exception as e:
            logger.error(f"Direct TigerGraph connection failed: {e}")
            return False

    @property
    def is_connected(self) -> bool:
        return self._service_available or self._direct_available

    @property
    def mode(self) -> str:
        if self._service_available:
            return "rest_api"
        elif self._direct_available:
            return "direct"
        return "offline"

    # ── Retrieval (Core API) ──────────────────────────────

    def retrieve(
        self,
        query: str,
        retriever: str = "hybrid",
        top_k: int = 5,
        num_hops: int = 2,
        community_level: int = 1,
    ) -> RetrievalResult:
        """
        Retrieve context for a query using the specified retriever.

        Args:
            query: The question to retrieve context for
            retriever: One of "hybrid", "community", "sibling"
            top_k: Number of top results to return
            num_hops: Graph traversal depth (for hybrid/sibling)
            community_level: Leiden hierarchy level (for community)

        Returns:
            RetrievalResult with chunks, entities, and metadata
        """
        start = time.perf_counter()

        if self._service_available:
            result = self._retrieve_via_api(query, retriever, top_k, num_hops, community_level)
        elif self._direct_available:
            result = self._retrieve_via_direct(query, retriever, top_k, num_hops, community_level)
        else:
            result = RetrievalResult(
                content="[No TG GraphRAG connection — offline mode]",
                retriever_used=retriever,
            )

        result.latency_ms = (time.perf_counter() - start) * 1000
        return result

    def _retrieve_via_api(
        self, query: str, retriever: str, top_k: int, num_hops: int, community_level: int
    ) -> RetrievalResult:
        """Call the official TG GraphRAG REST API for retrieval."""
        import urllib.request
        import urllib.error

        payload = {
            "query": query,
            "top_k": top_k,
        }
        if retriever in ("hybrid", "sibling"):
            payload["num_hops"] = num_hops
        if retriever == "community":
            payload["community_level"] = community_level

        # Try multiple endpoint patterns (official repo may use different paths)
        endpoint_patterns = [
            f"/retrieve/{retriever}",
            f"/api/retrieve/{retriever}",
            f"/graphrag/retrieve/{retriever}",
            f"/api/v1/retrieve/{retriever}",
            f"/retrieve",              # with retriever in body
            f"/api/retrieve",          # with retriever in body
            f"/query",                 # generic query endpoint
            f"/api/query",
        ]

        # For generic endpoints, include retriever type in payload
        payload_with_type = {**payload, "retriever": retriever, "retriever_type": retriever}

        for path in endpoint_patterns:
            try:
                url = f"{self.service_url}{path}"
                body = json.dumps(payload_with_type if "/retrieve/" not in path else payload)
                req = urllib.request.Request(
                    url, data=body.encode("utf-8"), method="POST",
                    headers={"Content-Type": "application/json"}
                )
                if self._api_token:
                    req.add_header("Authorization", f"Bearer {self._api_token}")

                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read())
                    return self._parse_api_response(data, retriever)
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    continue  # try next endpoint pattern
                logger.error(f"API error on {path}: {e.code} {e.reason}")
                continue
            except (urllib.error.URLError, OSError, json.JSONDecodeError) as e:
                logger.debug(f"Endpoint {path} failed: {e}")
                continue

        logger.warning("All REST API endpoint patterns failed. Falling back to direct mode.")
        if self._direct_available:
            return self._retrieve_via_direct(query, retriever, top_k, num_hops, community_level)
        return RetrievalResult(content="[API retrieval failed]", retriever_used=retriever)

    def _parse_api_response(self, data: Dict, retriever: str) -> RetrievalResult:
        """Parse the response from the TG GraphRAG API into a RetrievalResult."""
        result = RetrievalResult(retriever_used=retriever)

        # Handle various response formats the API might return
        if isinstance(data, dict):
            # Standard format: {"results": [...], "answer": "..."}
            results = data.get("results", data.get("chunks", data.get("documents", [])))
            if isinstance(results, list):
                for item in results:
                    if isinstance(item, dict):
                        result.chunks.append({
                            "text": item.get("content", item.get("text", item.get("chunk_text", ""))),
                            "score": item.get("score", item.get("similarity", 0.0)),
                            "source": item.get("source", item.get("doc_id", "")),
                            "chunk_id": item.get("chunk_id", item.get("id", "")),
                        })
                    elif isinstance(item, str):
                        result.chunks.append({"text": item, "score": 0.0})

            # Extract entities if present
            entities = data.get("entities", data.get("nodes", []))
            if isinstance(entities, list):
                result.entities = entities

            # Extract relations if present
            relations = data.get("relations", data.get("edges", data.get("relationships", [])))
            if isinstance(relations, list):
                result.relations = [str(r) for r in relations]

            # Extract community summaries if present
            summaries = data.get("community_summaries", data.get("summaries", []))
            if isinstance(summaries, list):
                result.community_summaries = [str(s) for s in summaries]

            # Build combined content
            texts = [c.get("text", "") for c in result.chunks if c.get("text")]
            if result.community_summaries:
                texts = result.community_summaries + texts
            result.content = "\n\n".join(texts)

            # Answer if provided
            if "answer" in data:
                result.metadata["service_answer"] = data["answer"]

            result.metadata["raw_response_keys"] = list(data.keys())

        elif isinstance(data, list):
            for item in data:
                text = item.get("text", item.get("content", str(item))) if isinstance(item, dict) else str(item)
                result.chunks.append({"text": text, "score": 0.0})
            result.content = "\n\n".join(c["text"] for c in result.chunks)

        return result

    def _retrieve_via_direct(
        self, query: str, retriever: str, top_k: int, num_hops: int, community_level: int
    ) -> RetrievalResult:
        """
        Fallback: use pyTigerGraph direct GSQL queries.
        Maps official retriever names to our custom GSQL queries.
        """
        result = RetrievalResult(retriever_used=f"{retriever}_direct")

        if not self._conn:
            return result

        try:
            # Get query embedding for vector search
            from .orchestration_layer import EmbeddingManager
            embedder = EmbeddingManager()
            embedder.initialize()
            query_emb = embedder.embed_single(query)

            if retriever == "hybrid":
                # Hybrid = vector search chunks + entity traversal
                chunks = self._run_query("vectorSearchChunks",
                                         {"queryVec": query_emb, "topK": top_k})
                entity_results = self._run_query("vectorSearchEntities",
                                                  {"queryVec": query_emb, "topK": top_k})
                seed_ids = [e.get("entity_id", "") for e in
                            (entity_results[0].get("@@topEntities", []) if entity_results else [])]
                if seed_ids:
                    traversal = self._run_query("graphRAGTraverse",
                                                {"seedEntityIds": seed_ids, "hops": num_hops})
                    if traversal:
                        for r in traversal:
                            if "@@chunkTexts" in r:
                                for text in r["@@chunkTexts"]:
                                    result.chunks.append({"text": text, "score": 0.0})
                            if "@@relationDescriptions" in r:
                                result.relations = list(r["@@relationDescriptions"])

                # Also add vector search results
                if chunks:
                    for c in chunks[0].get("@@topChunks", []):
                        result.chunks.append({
                            "text": c.get("text", c.get("chunk_id", "")),
                            "score": c.get("score", 0.0),
                        })

                result.content = "\n\n".join(c["text"] for c in result.chunks[:top_k] if c.get("text"))

            elif retriever == "community":
                # Community retriever — use community summaries
                chunks = self._run_query("vectorSearchChunks",
                                         {"queryVec": query_emb, "topK": top_k})
                if chunks:
                    for c in chunks[0].get("@@topChunks", []):
                        result.chunks.append({"text": c.get("text", ""), "score": c.get("score", 0.0)})
                result.content = "\n\n".join(c["text"] for c in result.chunks if c.get("text"))

            elif retriever == "sibling":
                # Sibling retriever — entity neighbors
                entity_results = self._run_query("vectorSearchEntities",
                                                  {"queryVec": query_emb, "topK": top_k})
                seed_ids = [e.get("entity_id", "") for e in
                            (entity_results[0].get("@@topEntities", []) if entity_results else [])]
                if seed_ids:
                    traversal = self._run_query("graphRAGTraverse",
                                                {"seedEntityIds": seed_ids, "hops": num_hops})
                    if traversal:
                        for r in traversal:
                            if "@@chunkTexts" in r:
                                for text in r["@@chunkTexts"]:
                                    result.chunks.append({"text": text, "score": 0.0})
                            if "@@relationDescriptions" in r:
                                result.relations = list(r["@@relationDescriptions"])
                result.content = "\n\n".join(c["text"] for c in result.chunks[:top_k] if c.get("text"))

        except Exception as e:
            logger.error(f"Direct retrieval failed: {e}")
            result.content = f"[Retrieval error: {e}]"

        return result

    def _run_query(self, query_name: str, params: Dict) -> List[Dict]:
        """Run an installed GSQL query."""
        try:
            return self._conn.runInstalledQuery(query_name, params=params)
        except Exception as e:
            logger.error(f"GSQL query {query_name} failed: {e}")
            return []

    # ── Full Q&A (Retrieval + Generation) ─────────────────

    def query(
        self,
        question: str,
        retriever: str = "hybrid",
        top_k: int = 5,
        num_hops: int = 2,
        community_level: int = 1,
        llm_layer=None,
    ) -> GraphRAGAnswer:
        """
        Full GraphRAG Q&A: retrieve context → generate answer.

        If the TG GraphRAG service provides its own answer, use that.
        Otherwise, retrieve context and pass to our LLM layer for generation.
        """
        start = time.perf_counter()
        retrieval = self.retrieve(query=question, retriever=retriever,
                                   top_k=top_k, num_hops=num_hops,
                                   community_level=community_level)
        answer_obj = GraphRAGAnswer(retrieval=retrieval)

        # If the service already returned an answer, use it
        service_answer = retrieval.metadata.get("service_answer", "")
        if service_answer:
            answer_obj.answer = service_answer
        elif llm_layer and retrieval.content:
            # Generate answer using our LLM layer with retrieved context
            resp = llm_layer.generate_answer(question, retrieval.content,
                system_prompt=(
                    "You are a knowledgeable assistant with access to a knowledge graph. "
                    "Use the structured context including entities, relationships, and passages "
                    "to answer accurately. Follow relationship chains for multi-hop reasoning. "
                    "Be concise and precise."
                ))
            answer_obj.answer = resp.content
            answer_obj.input_tokens = resp.input_tokens
            answer_obj.output_tokens = resp.output_tokens
            answer_obj.total_tokens = resp.total_tokens
            answer_obj.cost_usd = resp.cost_usd
        else:
            answer_obj.answer = "[No context retrieved and no LLM available]"

        answer_obj.latency_ms = (time.perf_counter() - start) * 1000
        return answer_obj

    # ── Document Ingestion via Service ────────────────────

    def ingest_document(
        self,
        doc_id: str,
        title: str,
        content: str,
        source: str = "",
    ) -> Dict[str, Any]:
        """
        Ingest a document via the TG GraphRAG service API.
        Falls back to direct pyTigerGraph if service is unavailable.
        """
        if self._service_available:
            return self._ingest_via_api(doc_id, title, content, source)
        elif self._direct_available:
            return self._ingest_via_direct(doc_id, title, content, source)
        return {"status": "error", "message": "No connection available"}

    def _ingest_via_api(self, doc_id, title, content, source) -> Dict:
        import urllib.request
        payload = json.dumps({
            "doc_id": doc_id, "title": title,
            "content": content, "source": source,
        })
        for path in ["/ingest", "/api/ingest", "/documents", "/api/documents"]:
            try:
                url = f"{self.service_url}{path}"
                req = urllib.request.Request(
                    url, data=payload.encode(), method="POST",
                    headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=60) as resp:
                    return json.loads(resp.read())
            except Exception:
                continue
        return {"status": "error", "message": "All ingest endpoints failed"}

    def _ingest_via_direct(self, doc_id, title, content, source) -> Dict:
        try:
            self._conn.upsertVertex("Document", doc_id, {
                "title": title, "content": content, "source": source})
            return {"status": "ok", "doc_id": doc_id}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # ── Status / Debug ────────────────────────────────────

    def status(self) -> Dict[str, Any]:
        """Return connection status and available features."""
        return {
            "mode": self.mode,
            "service_url": self.service_url if self._service_available else None,
            "tg_host": self.tg_host if self._direct_available else None,
            "tg_graph": self.tg_graph,
            "service_available": self._service_available,
            "direct_available": self._direct_available,
            "available_retrievers": ["hybrid", "community", "sibling"],
            "openapi_endpoints": list(self._openapi_spec.get("paths", {}).keys())[:20],
        }
