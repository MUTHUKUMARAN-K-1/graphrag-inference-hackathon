"""
Layer 2: Inference Orchestration — Triple Pipeline Manager
==========================================================
Routes queries through three pipelines:
  Pipeline 1: LLM-Only (no retrieval — worst-case baseline)
  Pipeline 2: Basic RAG (vector embeddings + LLM — industry standard)
  Pipeline 3: GraphRAG (TigerGraph GraphRAG repo + novelty engine)

Collects metrics for all three and provides adaptive routing.
"""
import json
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .graph_layer import GraphLayer, cosine_similarity
from .llm_layer import LLMLayer, LLMResponse, TokenTracker

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    """Result from a single pipeline execution."""
    answer: str = ""
    contexts: List[str] = field(default_factory=list)
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    pipeline_type: str = ""
    entities_found: List[Dict] = field(default_factory=list)
    relations_traversed: List[str] = field(default_factory=list)
    hops_used: int = 0
    complexity_score: float = 0.0
    query_type: str = ""
    token_breakdown: Dict = field(default_factory=dict)
    novelty_chain: List[str] = field(default_factory=list)
    retriever_used: str = ""


@dataclass
class TripleComparisonResult:
    """Side-by-side comparison of all 3 pipelines."""
    query: str = ""
    llm_only: PipelineResult = field(default_factory=PipelineResult)
    baseline: PipelineResult = field(default_factory=PipelineResult)
    graphrag: PipelineResult = field(default_factory=PipelineResult)
    token_savings_vs_baseline_pct: float = 0.0
    token_savings_vs_llm_only_pct: float = 0.0
    latency_diff_ms: float = 0.0
    cost_diff_usd: float = 0.0
    recommended_pipeline: str = ""
    routing_reason: str = ""


# Keep backward compat
@dataclass
class ComparisonResult:
    """Side-by-side comparison of both pipelines (backward compat)."""
    query: str = ""
    baseline: PipelineResult = field(default_factory=PipelineResult)
    graphrag: PipelineResult = field(default_factory=PipelineResult)
    token_savings_pct: float = 0.0
    latency_diff_ms: float = 0.0
    cost_diff_usd: float = 0.0
    recommended_pipeline: str = ""
    routing_reason: str = ""


class EmbeddingManager:
    """Manages embedding generation (OpenAI or local)."""

    def __init__(self, provider="openai", model="text-embedding-3-small",
                 api_key="", dimension=1536):
        self.provider = provider
        self.model = model
        self._api_key = api_key
        self.dimension = dimension
        self._client = None
        self._local_model = None

    def initialize(self):
        import os
        if os.getenv("EMBEDDING_PROVIDER", "local") == "openai" and self.provider == "openai":
            try:
                from openai import OpenAI
                key = self._api_key or os.getenv("OPENAI_API_KEY", "")
                if key:
                    base_url = os.getenv("OPENAI_BASE_URL", "")
                    self._client = OpenAI(api_key=key, base_url=base_url) if base_url else OpenAI(api_key=key)
                    logger.info(f"OpenAI embeddings: {self.model}")
                else:
                    self._init_local()
            except ImportError:
                self._init_local()
        else:
            self._init_local()

    def _init_local(self):
        try:
            from sentence_transformers import SentenceTransformer
            self._local_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
            self.dimension = 384
            self.provider = "local"
            logger.info("Local embeddings: all-MiniLM-L6-v2")
        except ImportError:
            logger.warning("No embedding model available — zero vectors")

    def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts: return []
        if self.provider == "openai" and self._client:
            try:
                resp = self._client.embeddings.create(input=texts, model=self.model)
                return [item.embedding for item in resp.data]
            except Exception as e:
                logger.error(f"Embedding error: {e}")
                return [[0.0] * self.dimension for _ in texts]
        elif self._local_model:
            return [emb.tolist() for emb in self._local_model.encode(texts)]
        return [[0.0] * self.dimension for _ in texts]

    def embed_single(self, text: str) -> List[float]:
        r = self.embed([text])
        return r[0] if r else [0.0] * self.dimension


class InferenceOrchestrator:
    """
    Layer 2: Manages all three pipelines and routes queries.
      Pipeline 1: LLM-Only (no retrieval)
      Pipeline 2: Basic RAG (vector search + LLM)
      Pipeline 3: GraphRAG (TG GraphRAG service + novelty engine)
    """

    def __init__(self, graph_layer=None, llm_layer=None, embedder=None,
                 tg_graphrag_client=None, novelty_engine=None, config=None):
        self.graph = graph_layer or GraphLayer()
        self.llm = llm_layer or LLMLayer()
        self.embedder = embedder or EmbeddingManager()
        self.tg_client = tg_graphrag_client  # official TG GraphRAG service client
        self.novelty_engine = novelty_engine  # NoveltyEngine from novelties.py
        self.config = config or {}
        self.llm_only_tracker = TokenTracker()
        self.baseline_tracker = TokenTracker()
        self.graphrag_tracker = TokenTracker()
        self.comparison_history: List[TripleComparisonResult] = []

    def initialize(self):
        self.llm.initialize()
        self.embedder.initialize()

        # Initialize TG GraphRAG client if not provided
        if self.tg_client is None:
            try:
                from .tg_graphrag_client import TGGraphRAGClient
                self.tg_client = TGGraphRAGClient()
                self.tg_client.connect()
            except Exception as e:
                logger.info(f"TG GraphRAG client not available: {e}")

        # Initialize NoveltyEngine if not provided
        if self.novelty_engine is None:
            try:
                from .novelties import NoveltyEngine
                self.novelty_engine = NoveltyEngine(
                    token_budget=self.config.get("token_budget", 2000))
                logger.info("NoveltyEngine initialized.")
            except Exception as e:
                logger.warning(f"NoveltyEngine not available: {e}")

        logger.info("Inference Orchestrator initialized (3-pipeline mode).")

    # ── Pipeline 1: LLM-Only (No Retrieval) ─────────────────

    def run_llm_only(self, query: str) -> PipelineResult:
        """
        Pipeline 1: LLM-Only — raw prompt in, answer out. No retrieval.
        This is the worst-case baseline: the LLM uses only its parametric knowledge.
        """
        start = time.perf_counter()
        result = PipelineResult(pipeline_type="llm_only")

        sys_prompt = (
            "You are a knowledgeable assistant. Answer the question accurately and concisely "
            "based on your knowledge. If you are not sure, say so."
        )
        resp = self.llm.generate([
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": f"Question: {query}\n\nAnswer:"},
        ], max_tokens=512)

        result.answer = resp.content
        result.input_tokens = resp.input_tokens
        result.output_tokens = resp.output_tokens
        result.total_tokens = resp.total_tokens
        result.cost_usd = resp.cost_usd
        result.latency_ms = (time.perf_counter() - start) * 1000
        self.llm_only_tracker.record(resp, "llm_only")
        return result

    # ── Pipeline 2: Basic RAG ────────────────────────────────

    def run_baseline_rag(self, query, passages=None, top_k=5):
        """
        Pipeline 2: Basic RAG — Query → Embed → Vector Search → Top-K Chunks → LLM → Answer
        Industry standard vector-based retrieval augmented generation.
        """
        start = time.perf_counter()
        result = PipelineResult(pipeline_type="baseline")
        ti = to = cost = 0.0

        if passages:
            query_emb = self.embedder.embed_single(query)
            passage_embs = self.embedder.embed(passages)
            scored = sorted(
                [(cosine_similarity(query_emb, emb), p) for p, emb in zip(passages, passage_embs)],
                reverse=True
            )
            result.contexts = [p for _, p in scored[:top_k]]
        elif self.graph.is_connected:
            query_emb = self.embedder.embed_single(query)
            chunks = self.graph.vector_search_chunks(query_emb, top_k)
            result.contexts = [c.get("text", "") for c in chunks]
        else:
            result.contexts = ["[No context available — connect TigerGraph or provide passages]"]

        ctx_text = "\n\n".join(result.contexts[:top_k])
        resp = self.llm.generate_answer(query, ctx_text)
        result.answer = resp.content
        ti += resp.input_tokens; to += resp.output_tokens; cost += resp.cost_usd
        result.input_tokens = int(ti); result.output_tokens = int(to)
        result.total_tokens = int(ti + to); result.cost_usd = cost
        result.latency_ms = (time.perf_counter() - start) * 1000
        self.baseline_tracker.record(resp, "baseline")
        return result

    # ── Pipeline 3: GraphRAG (TG GraphRAG + Novelties) ──────

    def run_graphrag(self, query, passages=None, seed_entities=5, hops=2,
                     max_ctx=10, retriever="hybrid", community_level=1):
        """
        Pipeline 3: GraphRAG — Built on top of the TigerGraph GraphRAG repo.

        Flow:
          1. Call TG GraphRAG service (official repo REST API) for retrieval
          2. Apply NoveltyEngine enhancements (PPR, activation, token budget, etc.)
          3. Build structured context with entities + relationships + passages
          4. Generate answer with graph-aware LLM prompt

        Falls back to direct pyTigerGraph GSQL queries if service unavailable.
        Falls back to passage-based entity extraction if no TG connection.
        """
        start = time.perf_counter()
        result = PipelineResult(pipeline_type="graphrag", retriever_used=retriever)
        ti = to = cost = 0.0

        # Step 1: Extract dual-level keywords (LightRAG-inspired novelty)
        kw_resp = self.llm.extract_keywords(query)
        ti += kw_resp.input_tokens; to += kw_resp.output_tokens; cost += kw_resp.cost_usd
        self.graphrag_tracker.record(kw_resp, "keywords")

        try:
            kws = json.loads(kw_resp.content)
        except json.JSONDecodeError:
            kws = {"high_level": [], "low_level": [query]}

        low_level = kws.get("low_level", [])

        # Step 2: Try TG GraphRAG service first (official repo integration)
        tg_used = False
        if self.tg_client and self.tg_client.is_connected:
            try:
                tg_result = self.tg_client.retrieve(
                    query=query, retriever=retriever,
                    top_k=seed_entities * 2, num_hops=hops,
                    community_level=community_level,
                )
                if tg_result.chunks:
                    result.contexts = [c.get("text", "") for c in tg_result.chunks[:max_ctx]]
                    result.entities_found = tg_result.entities
                    result.relations_traversed = tg_result.relations
                    result.hops_used = hops
                    tg_used = True
                    logger.info(f"TG GraphRAG service returned {len(tg_result.chunks)} chunks")
            except Exception as e:
                logger.warning(f"TG GraphRAG service call failed: {e}")

        # Step 2b: Fall back to direct pyTigerGraph if service failed
        if not tg_used and self.graph.is_connected:
            search_text = " ".join(low_level) if low_level else query
            query_emb = self.embedder.embed_single(search_text)
            ents = self.graph.vector_search_entities(query_emb, seed_entities)
            seed_ids = [e.get("entity_id", "") for e in ents]
            result.entities_found = [
                {"name": e.get("name",""), "entity_type": e.get("entity_type",""),
                 "description": e.get("description",""), "score": e.get("score",0)}
                for e in ents
            ]
            if seed_ids:
                traversal = self.graph.graph_traverse(seed_ids, hops)
                result.contexts = traversal.get("chunk_texts", [])[:max_ctx]
                result.relations_traversed = traversal.get("relations", [])
                result.hops_used = hops
            tg_used = True

        # Step 2c: Fallback for offline mode — simulate with passages + entity extraction
        if not tg_used and passages:
            query_emb = self.embedder.embed_single(query)
            passage_embs = self.embedder.embed(passages)
            scored = sorted(
                [(cosine_similarity(query_emb, emb), p, i)
                 for i, (p, emb) in enumerate(zip(passages, passage_embs))],
                reverse=True
            )
            top_p = scored[:3]
            all_ent_names = set()
            for _, passage, _ in top_p:
                ext_resp = self.llm.extract_entities(passage)
                ti += ext_resp.input_tokens; to += ext_resp.output_tokens; cost += ext_resp.cost_usd
                self.graphrag_tracker.record(ext_resp, "entity_extraction")
                try:
                    extracted = json.loads(ext_resp.content)
                    for ent in extracted.get("entities", []):
                        all_ent_names.add(ent.get("name", ""))
                        result.entities_found.append(ent)
                    for rel in extracted.get("relations", []):
                        result.relations_traversed.append(
                            f"{rel['source']} -[{rel['type']}]-> {rel['target']}: {rel.get('description','')}")
                except json.JSONDecodeError:
                    pass

            # Multi-hop simulation: expand by entity mentions
            expanded = []
            for _, passage, idx in scored:
                for en in all_ent_names:
                    if en.lower() in passage.lower():
                        expanded.append(passage)
                        break
            all_ctx = [p for _, p, _ in top_p]
            for ep in expanded:
                if ep not in all_ctx: all_ctx.append(ep)
            result.contexts = all_ctx[:max_ctx]
            result.hops_used = hops

        # Step 3: Apply NoveltyEngine enhancements if available
        if self.novelty_engine and result.entities_found and result.contexts:
            try:
                # Build adjacency from extracted relations
                adjacency: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
                entity_to_chunks: Dict[str, List[str]] = defaultdict(list)
                chunk_texts: Dict[str, str] = {}

                for i, ctx in enumerate(result.contexts):
                    cid = f"ctx_{i}"
                    chunk_texts[cid] = ctx

                for e in result.entities_found:
                    ename = e.get("name", "").lower()
                    for i, ctx in enumerate(result.contexts):
                        if ename in ctx.lower():
                            entity_to_chunks[ename].append(f"ctx_{i}")

                for rel_str in result.relations_traversed:
                    parts = rel_str.split(" -[")
                    if len(parts) >= 2:
                        src = parts[0].strip().lower()
                        rest = parts[1].split("]->")
                        if len(rest) >= 2:
                            tgt = rest[1].split(":")[0].strip().lower()
                            adjacency[src].append((tgt, 0.8))
                            adjacency[tgt].append((src, 0.8))

                seed_ents = [e.get("name", "").lower() for e in result.entities_found[:5]]

                if adjacency and seed_ents and entity_to_chunks:
                    novelty_result = self.novelty_engine.enhanced_retrieve(
                        query=query,
                        adjacency=adjacency,
                        seed_entities=seed_ents,
                        entity_to_chunks=entity_to_chunks,
                        chunk_texts=chunk_texts,
                    )
                    if novelty_result.get("contexts"):
                        result.contexts = novelty_result["contexts"]
                    result.novelty_chain = novelty_result.get("technique_chain", [])
                    logger.info(f"NoveltyEngine applied: {result.novelty_chain}")
            except Exception as e:
                logger.warning(f"NoveltyEngine enhancement failed: {e}")

        # Step 4: Build structured context with graph information
        ctx_parts = []
        if result.entities_found:
            ent_list = result.entities_found[:10]
            if isinstance(ent_list[0], dict):
                ctx_parts.append("### Entities Found:\n" + "\n".join(
                    [f"- **{e.get('name','?')}** ({e.get('entity_type','?')}): {e.get('description','')}"
                     for e in ent_list]))
            else:
                ctx_parts.append("### Entities Found:\n" + "\n".join(
                    [f"- {e}" for e in ent_list]))
        if result.relations_traversed:
            ctx_parts.append("### Relationships:\n" + "\n".join(
                [f"- {r}" for r in result.relations_traversed[:15]]))
        if result.contexts:
            ctx_parts.append("### Retrieved Passages:\n" + "\n\n".join(
                [f"[Passage {i+1}]: {c}" for i, c in enumerate(result.contexts[:max_ctx])]))

        structured = "\n\n".join(ctx_parts)
        sys_prompt = (
            "You are a knowledgeable assistant with access to a knowledge graph. "
            "Use the structured context including entities, relationships, and passages "
            "to answer accurately. Follow relationship chains for multi-hop reasoning. Be concise."
        )
        gen_resp = self.llm.generate_answer(query, structured, sys_prompt)
        ti += gen_resp.input_tokens; to += gen_resp.output_tokens; cost += gen_resp.cost_usd
        self.graphrag_tracker.record(gen_resp, "graphrag_gen")

        result.answer = gen_resp.content
        result.input_tokens = int(ti); result.output_tokens = int(to)
        result.total_tokens = int(ti + to); result.cost_usd = cost
        result.latency_ms = (time.perf_counter() - start) * 1000
        return result

    # ── Adaptive Query Router (Novelty) ─────────────────────

    def analyze_complexity(self, query):
        """Analyze query complexity for adaptive routing."""
        resp = self.llm.analyze_query_complexity(query)
        try:
            a = json.loads(resp.content)
            return float(a.get("complexity_score", 0.5)), a.get("query_type", "unknown"), a.get("reasoning", "")
        except (json.JSONDecodeError, ValueError):
            return 0.5, "unknown", "Analysis failed"

    def run_triple_comparison(self, query, passages=None, top_k=5, hops=2):
        """Run all 3 pipelines and compare side-by-side."""
        lo = self.run_llm_only(query)
        b = self.run_baseline_rag(query, passages, top_k)
        g = self.run_graphrag(query, passages, hops=hops)

        comp = TripleComparisonResult(query=query, llm_only=lo, baseline=b, graphrag=g)
        if b.total_tokens > 0:
            comp.token_savings_vs_baseline_pct = (
                (b.total_tokens - g.total_tokens) / b.total_tokens * 100
            )
        if lo.total_tokens > 0:
            comp.token_savings_vs_llm_only_pct = (
                (lo.total_tokens - g.total_tokens) / lo.total_tokens * 100
            )
        comp.latency_diff_ms = g.latency_ms - b.latency_ms
        comp.cost_diff_usd = g.cost_usd - b.cost_usd
        self.comparison_history.append(comp)
        return comp

    # Backward compat — 2-pipeline comparison
    def run_comparison(self, query, passages=None, top_k=5, hops=2):
        """Run both pipelines and compare (backward compat)."""
        b = self.run_baseline_rag(query, passages, top_k)
        g = self.run_graphrag(query, passages, hops=hops)
        comp = ComparisonResult(query=query, baseline=b, graphrag=g)
        if b.total_tokens > 0:
            comp.token_savings_pct = (g.total_tokens - b.total_tokens) / b.total_tokens * 100
        comp.latency_diff_ms = g.latency_ms - b.latency_ms
        comp.cost_diff_usd = g.cost_usd - b.cost_usd
        return comp

    def run_adaptive(self, query, passages=None, threshold=0.6):
        """Adaptive routing: automatically picks optimal pipeline."""
        score, qtype, reasoning = self.analyze_complexity(query)
        comp = self.run_triple_comparison(query, passages)
        comp.graphrag.complexity_score = score
        comp.graphrag.query_type = qtype
        if score >= threshold:
            comp.recommended_pipeline = "graphrag"
            comp.routing_reason = f"Complex query (score={score:.2f}, type={qtype}): {reasoning}"
        else:
            comp.recommended_pipeline = "baseline"
            comp.routing_reason = f"Simple query (score={score:.2f}, type={qtype}): {reasoning}"
        return comp

    def explain_graphrag_reasoning(self, query, graphrag_result):
        """Generate reasoning path explanation (novelty)."""
        resp = self.llm.generate_graph_explanation(
            query, graphrag_result.entities_found,
            graphrag_result.relations_traversed, graphrag_result.answer)
        return resp.content

    def get_aggregate_metrics(self):
        if not self.comparison_history: return {"message": "No comparisons"}
        n = len(self.comparison_history)
        return {
            "total_queries": n,
            "llm_only": {
                "total_tokens": sum(c.llm_only.total_tokens for c in self.comparison_history),
                "avg_tokens": sum(c.llm_only.total_tokens for c in self.comparison_history) / n,
                "total_cost": sum(c.llm_only.cost_usd for c in self.comparison_history),
                "avg_latency": sum(c.llm_only.latency_ms for c in self.comparison_history) / n,
            },
            "baseline": {
                "total_tokens": sum(c.baseline.total_tokens for c in self.comparison_history),
                "avg_tokens": sum(c.baseline.total_tokens for c in self.comparison_history) / n,
                "total_cost": sum(c.baseline.cost_usd for c in self.comparison_history),
                "avg_latency": sum(c.baseline.latency_ms for c in self.comparison_history) / n,
            },
            "graphrag": {
                "total_tokens": sum(c.graphrag.total_tokens for c in self.comparison_history),
                "avg_tokens": sum(c.graphrag.total_tokens for c in self.comparison_history) / n,
                "total_cost": sum(c.graphrag.cost_usd for c in self.comparison_history),
                "avg_latency": sum(c.graphrag.latency_ms for c in self.comparison_history) / n,
            },
        }
