"""
Layer 2: Inference Orchestration — Dual Pipeline Manager
========================================================
Routes queries through Baseline RAG and GraphRAG pipelines,
collects metrics, and provides adaptive routing.
"""
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

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


@dataclass
class ComparisonResult:
    """Side-by-side comparison of both pipelines."""
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
        if self.provider == "openai":
            try:
                from openai import OpenAI
                import os
                key = self._api_key or os.getenv("OPENAI_API_KEY", "")
                if key:
                    self._client = OpenAI(api_key=key)
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
    Layer 2: Manages both pipelines and routes queries.
    """

    def __init__(self, graph_layer=None, llm_layer=None, embedder=None, config=None):
        self.graph = graph_layer or GraphLayer()
        self.llm = llm_layer or LLMLayer()
        self.embedder = embedder or EmbeddingManager()
        self.config = config or {}
        self.baseline_tracker = TokenTracker()
        self.graphrag_tracker = TokenTracker()
        self.comparison_history: List[ComparisonResult] = []

    def initialize(self):
        self.llm.initialize()
        self.embedder.initialize()
        logger.info("Inference Orchestrator initialized.")

    # ── Pipeline A: Baseline RAG ────────────────────────────

    def run_baseline_rag(self, query, passages=None, top_k=5):
        """
        Pipeline A: Query → Embed → Vector Search → Top-K Chunks → LLM → Answer
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

    # ── Pipeline B: GraphRAG ────────────────────────────────

    def run_graphrag(self, query, passages=None, seed_entities=5, hops=2, max_ctx=10):
        """
        Pipeline B: Query → Keywords → Entity Search → Graph Traverse → Structured Context → LLM
        Novelties: Dual-level keywords, schema-bounded extraction, graph reasoning
        """
        start = time.perf_counter()
        result = PipelineResult(pipeline_type="graphrag")
        ti = to = cost = 0.0

        # Step 1: Extract dual-level keywords (LightRAG-inspired)
        kw_resp = self.llm.extract_keywords(query)
        ti += kw_resp.input_tokens; to += kw_resp.output_tokens; cost += kw_resp.cost_usd
        self.graphrag_tracker.record(kw_resp, "keywords")

        try:
            kws = json.loads(kw_resp.content)
        except json.JSONDecodeError:
            kws = {"high_level": [], "low_level": [query]}

        low_level = kws.get("low_level", [])

        if self.graph.is_connected:
            # Step 2: Find seed entities via vector search
            search_text = " ".join(low_level) if low_level else query
            query_emb = self.embedder.embed_single(search_text)
            ents = self.graph.vector_search_entities(query_emb, seed_entities)
            seed_ids = [e.get("entity_id", "") for e in ents]
            result.entities_found = [
                {"name": e.get("name",""), "entity_type": e.get("entity_type",""),
                 "description": e.get("description",""), "score": e.get("score",0)}
                for e in ents
            ]
            # Step 3: Multi-hop graph traversal
            if seed_ids:
                traversal = self.graph.graph_traverse(seed_ids, hops)
                result.contexts = traversal.get("chunk_texts", [])[:max_ctx]
                result.relations_traversed = traversal.get("relations", [])
                result.hops_used = hops
        else:
            # Fallback: simulate GraphRAG with passages + entity extraction
            if passages:
                query_emb = self.embedder.embed_single(query)
                passage_embs = self.embedder.embed(passages)
                scored = sorted(
                    [(cosine_similarity(query_emb, emb), p, i)
                     for i, (p, emb) in enumerate(zip(passages, passage_embs))],
                    reverse=True
                )

                # Extract entities from top passages (simulates graph construction)
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

        # Step 4: Build structured context with graph information
        ctx_parts = []
        if result.entities_found:
            ctx_parts.append("### Entities Found:\n" + "\n".join(
                [f"- **{e.get('name','?')}** ({e.get('entity_type','?')}): {e.get('description','')}"
                 for e in result.entities_found[:10]]))
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

    def run_comparison(self, query, passages=None, top_k=5, hops=2):
        """Run both pipelines and compare."""
        b = self.run_baseline_rag(query, passages, top_k)
        g = self.run_graphrag(query, passages, hops=hops)
        comp = ComparisonResult(query=query, baseline=b, graphrag=g)
        if b.total_tokens > 0:
            comp.token_savings_pct = (g.total_tokens - b.total_tokens) / b.total_tokens * 100
        comp.latency_diff_ms = g.latency_ms - b.latency_ms
        comp.cost_diff_usd = g.cost_usd - b.cost_usd
        self.comparison_history.append(comp)
        return comp

    def run_adaptive(self, query, passages=None, threshold=0.6):
        """Adaptive routing: automatically picks optimal pipeline."""
        score, qtype, reasoning = self.analyze_complexity(query)
        comp = self.run_comparison(query, passages)
        comp.baseline.complexity_score = score
        comp.baseline.query_type = qtype
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
