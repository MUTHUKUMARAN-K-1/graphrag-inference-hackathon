"""
Layer 3: LLM Layer — All LLM interactions with token tracking
=============================================================
Handles generation, entity extraction, keyword extraction,
query complexity analysis, and graph reasoning explanation.
"""
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    """Container for LLM response with usage metadata."""
    content: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    model: str = ""


@dataclass
class TokenTracker:
    """Tracks cumulative token usage and costs."""
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost: float = 0.0
    call_count: int = 0
    calls: List[Dict] = field(default_factory=list)

    def record(self, resp: LLMResponse, label: str = ""):
        self.total_input_tokens += resp.input_tokens
        self.total_output_tokens += resp.output_tokens
        self.total_cost += resp.cost_usd
        self.call_count += 1
        self.calls.append({
            "label": label, "input_tokens": resp.input_tokens,
            "output_tokens": resp.output_tokens, "cost_usd": resp.cost_usd,
            "latency_ms": resp.latency_ms
        })

    def summary(self):
        return {
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_cost_usd": round(self.total_cost, 6),
            "call_count": self.call_count
        }


class LLMLayer:
    """
    Layer 3: Handles all LLM interactions.
    Supports OpenAI API with mock fallback for testing.
    """

    def __init__(self, api_key="", model="gpt-4o-mini",
                 cost_per_1k_input=0.00015, cost_per_1k_output=0.0006):
        self.model = model
        self.cost_in = cost_per_1k_input
        self.cost_out = cost_per_1k_output
        self.client = None
        self._api_key = api_key

    def initialize(self):
        """Initialize the OpenAI client."""
        try:
            from openai import OpenAI
            import os
            key = self._api_key or os.getenv("OPENAI_API_KEY", "")
            if key:
                base_url = os.getenv("OPENAI_BASE_URL", "")
                self.client = OpenAI(api_key=key, base_url=base_url) if base_url else OpenAI(api_key=key)
                logger.info(f"LLM initialized: {self.model}")
            else:
                logger.warning("No API key — using mock mode")
        except ImportError:
            logger.warning("openai not installed — mock mode")

    def _cost(self, inp, out):
        return inp / 1000 * self.cost_in + out / 1000 * self.cost_out

    def generate(self, messages, temperature=0.0, max_tokens=1024, json_mode=False):
        """Generate a response from the LLM."""
        start = time.perf_counter()

        if self.client is None:
            return LLMResponse(
                content="[Mock response — no API key configured]",
                input_tokens=50, output_tokens=20, total_tokens=70,
                latency_ms=100.0, cost_usd=self._cost(50, 20), model=self.model
            )

        try:
            kwargs = {"model": self.model, "messages": messages,
                      "temperature": temperature, "max_tokens": max_tokens}
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            resp = self.client.chat.completions.create(**kwargs)
            elapsed = (time.perf_counter() - start) * 1000
            u = resp.usage
            return LLMResponse(
                content=resp.choices[0].message.content,
                input_tokens=u.prompt_tokens, output_tokens=u.completion_tokens,
                total_tokens=u.prompt_tokens + u.completion_tokens,
                latency_ms=elapsed,
                cost_usd=self._cost(u.prompt_tokens, u.completion_tokens),
                model=self.model
            )
        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            logger.error(f"LLM error: {e}")
            return LLMResponse(content=f"[Error: {e}]", latency_ms=elapsed, model=self.model)

    # ── Specialized Functions ─────────────────────────────

    def generate_answer(self, query, context, system_prompt=None):
        """Generate an answer given query and context."""
        if not system_prompt:
            system_prompt = (
                "You are a helpful assistant. Answer accurately using ONLY the provided context. "
                "If the context doesn't contain enough info, say so. Be concise and precise."
            )
        return self.generate([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}\n\nAnswer:"}
        ], max_tokens=512)

    def extract_entities(self, text, entity_types=None, relation_types=None):
        """Extract entities and relationships using schema-bounded extraction (novelty)."""
        if not entity_types:
            entity_types = ["PERSON", "ORGANIZATION", "LOCATION", "EVENT",
                            "DATE", "CONCEPT", "WORK", "PRODUCT", "TECHNOLOGY"]
        if not relation_types:
            relation_types = ["WORKS_FOR", "LOCATED_IN", "FOUNDED_BY", "PART_OF",
                              "RELATED_TO", "CREATED_BY", "HAPPENED_IN", "MEMBER_OF",
                              "COLLABORATES_WITH", "INFLUENCES"]

        prompt = f"""Extract all entities and relationships from the text.
ALLOWED ENTITY TYPES: {json.dumps(entity_types)}
ALLOWED RELATION TYPES: {json.dumps(relation_types)}

Return JSON:
{{"entities": [{{"name": "exact name", "type": "one of allowed types", "description": "brief 1-sentence"}}],
 "relations": [{{"source": "source entity name", "target": "target entity name", "type": "one of allowed types", "description": "brief"}}]}}

Text: {text}"""
        return self.generate([{"role": "user", "content": prompt}], max_tokens=4096, json_mode=False)

    def extract_keywords(self, query):
        """Extract dual-level keywords for GraphRAG retrieval (novelty: LightRAG-inspired)."""
        prompt = """Extract search keywords from this question. Return JSON:
{"high_level": ["abstract themes/topics"], "low_level": ["specific entities/names/dates"]}

Question: """ + query
        return self.generate([{"role": "user", "content": prompt}], max_tokens=256, json_mode=True)

    def analyze_query_complexity(self, query):
        """Analyze query complexity for adaptive routing (novelty)."""
        prompt = """Rate this question's complexity from 0.0 to 1.0. Return JSON:
{"complexity_score": 0.0-1.0, "reasoning": "brief", "query_type": "factoid|comparison|bridge|multi_hop", "estimated_hops": 1-4}

Score guide: 0.0-0.3 simple factoid, 0.3-0.6 moderate, 0.6-0.8 complex multi-entity, 0.8-1.0 multi-hop reasoning

Question: """ + query
        return self.generate([{"role": "user", "content": prompt}], max_tokens=256, json_mode=True)

    def generate_graph_explanation(self, query, entities, relations, answer):
        """Generate natural language explanation of graph reasoning path (novelty)."""
        ent_str = "\n".join([f"- {e.get('name','?')} ({e.get('entity_type','?')}): {e.get('description','')}"
                             for e in entities[:10]])
        rel_str = "\n".join([f"- {r}" for r in relations[:15]])
        prompt = f"""Explain the graph reasoning path for this answer step-by-step.

Question: {query}

Entities Found:
{ent_str}

Relationships Traversed:
{rel_str}

Generated Answer: {answer}

Format as:
1. **Entry Points**: [which entities were found first]
2. **Traversal**: [which relationships were followed, use A → B → C notation]
3. **Evidence**: [which facts support the answer]
4. **Conclusion**: [how the answer was derived]"""
        return self.generate([{"role": "user", "content": prompt}], max_tokens=512)
