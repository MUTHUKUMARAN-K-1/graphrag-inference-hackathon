"""
Layer 4: Evaluation Layer — RAGAS + Custom Metrics + Benchmarking
=================================================================
Computes faithfulness, answer relevancy, context precision/recall,
F1, exact match, and cost efficiency metrics.
"""
import logging
import re
import string
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


# ── Custom Metrics (No LLM dependency) ────────────────────

def normalize_answer(s: str) -> str:
    """SQuAD/HotpotQA standard answer normalization."""
    def remove_articles(t): return re.sub(r'\b(a|an|the)\b', ' ', t)
    def white_space_fix(t): return ' '.join(t.split())
    def remove_punc(t): return ''.join(ch for ch in t if ch not in string.punctuation)
    return white_space_fix(remove_articles(remove_punc(s.lower())))


def compute_exact_match(prediction: str, ground_truth: str) -> float:
    """Exact match after normalization."""
    return float(normalize_answer(prediction) == normalize_answer(ground_truth))


def compute_f1(prediction: str, ground_truth: str) -> float:
    """Token-level F1 score (SQuAD/HotpotQA standard)."""
    pred_tokens = normalize_answer(prediction).split()
    gold_tokens = normalize_answer(ground_truth).split()
    if not pred_tokens and not gold_tokens: return 1.0
    if not pred_tokens or not gold_tokens: return 0.0
    common = Counter(pred_tokens) & Counter(gold_tokens)
    num_same = sum(common.values())
    if num_same == 0: return 0.0
    precision = num_same / len(pred_tokens)
    recall = num_same / len(gold_tokens)
    return (2 * precision * recall) / (precision + recall)


def compute_context_hit_rate(contexts: List[str], facts: List[str]) -> float:
    """Fraction of supporting facts found in retrieved contexts."""
    if not facts: return 0.0
    combined = " ".join(contexts).lower()
    return sum(1 for f in facts if f.lower() in combined) / len(facts)


def compute_token_efficiency(baseline_tokens: int, graphrag_tokens: int) -> float:
    """Token efficiency ratio: <1 means GraphRAG uses fewer tokens."""
    return graphrag_tokens / baseline_tokens if baseline_tokens > 0 else 0.0


# ── Data Structures ───────────────────────────────────────

@dataclass
class EvalSample:
    """Single evaluation sample."""
    query: str = ""
    reference_answer: str = ""
    baseline_answer: str = ""
    graphrag_answer: str = ""
    baseline_contexts: List[str] = field(default_factory=list)
    graphrag_contexts: List[str] = field(default_factory=list)
    question_type: str = ""
    difficulty: str = ""
    supporting_facts: List[str] = field(default_factory=list)


@dataclass
class EvalResult:
    """Evaluation result for a single sample."""
    query: str = ""
    baseline_f1: float = 0.0
    graphrag_f1: float = 0.0
    baseline_em: float = 0.0
    graphrag_em: float = 0.0
    baseline_context_hit: float = 0.0
    graphrag_context_hit: float = 0.0
    baseline_faithfulness: float = 0.0
    graphrag_faithfulness: float = 0.0
    baseline_relevancy: float = 0.0
    graphrag_relevancy: float = 0.0
    baseline_context_precision: float = 0.0
    graphrag_context_precision: float = 0.0
    baseline_context_recall: float = 0.0
    graphrag_context_recall: float = 0.0
    baseline_tokens: int = 0
    graphrag_tokens: int = 0
    baseline_cost: float = 0.0
    graphrag_cost: float = 0.0
    baseline_latency: float = 0.0
    graphrag_latency: float = 0.0
    question_type: str = ""
    difficulty: str = ""


# ── Evaluation Layer ──────────────────────────────────────

class EvaluationLayer:
    """
    Layer 4: Evaluation Layer.
    Computes all metrics and generates benchmark reports.
    """

    def __init__(self, eval_llm_model="gpt-4o-mini", api_key=""):
        self.eval_llm_model = eval_llm_model
        self._api_key = api_key
        self._ragas_available = False
        self.results: List[EvalResult] = []

    def initialize(self):
        """Initialize RAGAS components if available."""
        try:
            from ragas import evaluate, EvaluationDataset, SingleTurnSample
            from ragas.metrics import Faithfulness, AnswerRelevancy
            self._ragas_available = True
            logger.info("RAGAS evaluation available.")
        except ImportError:
            logger.warning("RAGAS not installed — using custom metrics only.")

    def evaluate_sample(self, sample: EvalSample,
                        baseline_tokens=0, graphrag_tokens=0,
                        baseline_cost=0.0, graphrag_cost=0.0,
                        baseline_latency=0.0, graphrag_latency=0.0) -> EvalResult:
        """Evaluate a single sample with all metrics."""
        r = EvalResult(
            query=sample.query,
            question_type=sample.question_type,
            difficulty=sample.difficulty,
            baseline_f1=compute_f1(sample.baseline_answer, sample.reference_answer),
            graphrag_f1=compute_f1(sample.graphrag_answer, sample.reference_answer),
            baseline_em=compute_exact_match(sample.baseline_answer, sample.reference_answer),
            graphrag_em=compute_exact_match(sample.graphrag_answer, sample.reference_answer),
            baseline_context_hit=compute_context_hit_rate(
                sample.baseline_contexts, sample.supporting_facts),
            graphrag_context_hit=compute_context_hit_rate(
                sample.graphrag_contexts, sample.supporting_facts),
            baseline_tokens=baseline_tokens, graphrag_tokens=graphrag_tokens,
            baseline_cost=baseline_cost, graphrag_cost=graphrag_cost,
            baseline_latency=baseline_latency, graphrag_latency=graphrag_latency,
        )
        self.results.append(r)
        return r

    def evaluate_batch_ragas(self, samples: List[EvalSample], pipeline="baseline") -> Dict[str, float]:
        """Run RAGAS evaluation on a batch (requires RAGAS + OpenAI key)."""
        if not self._ragas_available:
            return {}
        try:
            from ragas import evaluate, EvaluationDataset, SingleTurnSample
            from ragas.metrics import (Faithfulness, AnswerRelevancy,
                                       LLMContextPrecisionWithReference, LLMContextRecall)
            from ragas.llms import LangchainLLMWrapper
            from ragas.embeddings import LangchainEmbeddingsWrapper
            from langchain_openai import ChatOpenAI, OpenAIEmbeddings
            import os

            key = self._api_key or os.getenv("OPENAI_API_KEY", "")
            llm = LangchainLLMWrapper(ChatOpenAI(model=self.eval_llm_model, api_key=key))
            emb = LangchainEmbeddingsWrapper(OpenAIEmbeddings(api_key=key))

            ragas_samples = []
            for s in samples:
                answer = s.baseline_answer if pipeline == "baseline" else s.graphrag_answer
                ctxs = s.baseline_contexts if pipeline == "baseline" else s.graphrag_contexts
                if answer and ctxs:
                    ragas_samples.append(SingleTurnSample(
                        user_input=s.query, response=answer,
                        retrieved_contexts=ctxs, reference=s.reference_answer))

            if not ragas_samples: return {}
            dataset = EvaluationDataset(samples=ragas_samples)
            metrics = [Faithfulness(llm=llm), AnswerRelevancy(llm=llm, embeddings=emb),
                       LLMContextPrecisionWithReference(llm=llm), LLMContextRecall(llm=llm)]
            return dict(evaluate(dataset=dataset, metrics=metrics))
        except Exception as e:
            logger.error(f"RAGAS evaluation failed: {e}")
            return {}

    def compute_aggregate_metrics(self) -> Dict[str, Any]:
        """Compute aggregate metrics across all evaluated samples."""
        if not self.results: return {"message": "No results"}
        n = len(self.results)
        avg = lambda vals: sum(vals) / len(vals) if vals else 0.0

        b = {
            "avg_f1": round(avg([r.baseline_f1 for r in self.results]), 4),
            "avg_em": round(avg([r.baseline_em for r in self.results]), 4),
            "avg_context_hit": round(avg([r.baseline_context_hit for r in self.results]), 4),
            "avg_tokens": round(avg([r.baseline_tokens for r in self.results]), 1),
            "avg_cost": round(avg([r.baseline_cost for r in self.results]), 6),
            "avg_latency_ms": round(avg([r.baseline_latency for r in self.results]), 1),
            "total_tokens": sum(r.baseline_tokens for r in self.results),
            "total_cost": round(sum(r.baseline_cost for r in self.results), 6),
        }
        g = {
            "avg_f1": round(avg([r.graphrag_f1 for r in self.results]), 4),
            "avg_em": round(avg([r.graphrag_em for r in self.results]), 4),
            "avg_context_hit": round(avg([r.graphrag_context_hit for r in self.results]), 4),
            "avg_tokens": round(avg([r.graphrag_tokens for r in self.results]), 1),
            "avg_cost": round(avg([r.graphrag_cost for r in self.results]), 6),
            "avg_latency_ms": round(avg([r.graphrag_latency for r in self.results]), 1),
            "total_tokens": sum(r.graphrag_tokens for r in self.results),
            "total_cost": round(sum(r.graphrag_cost for r in self.results), 6),
        }

        win_rate = sum(1 for r in self.results if r.graphrag_f1 > r.baseline_f1) / n

        by_type = {}
        for r in self.results:
            qt = r.question_type or "unknown"
            by_type.setdefault(qt, {"baseline_f1": [], "graphrag_f1": [], "count": 0})
            by_type[qt]["baseline_f1"].append(r.baseline_f1)
            by_type[qt]["graphrag_f1"].append(r.graphrag_f1)
            by_type[qt]["count"] += 1

        return {
            "num_samples": n, "baseline": b, "graphrag": g,
            "graphrag_f1_win_rate": round(win_rate, 4),
            "token_ratio": round(g["total_tokens"] / max(b["total_tokens"], 1), 3),
            "by_question_type": {
                qt: {"count": d["count"],
                     "baseline_avg_f1": round(avg(d["baseline_f1"]), 4),
                     "graphrag_avg_f1": round(avg(d["graphrag_f1"]), 4)}
                for qt, d in by_type.items()
            }
        }

    def generate_report(self) -> str:
        """Generate a text benchmark report."""
        m = self.compute_aggregate_metrics()
        if "message" in m: return m["message"]
        lines = [
            "=" * 60, "GRAPHRAG INFERENCE BENCHMARK REPORT", "=" * 60,
            f"\nTotal Samples Evaluated: {m['num_samples']}",
            f"\n{'Metric':<25} {'Baseline':>12} {'GraphRAG':>12} {'Winner':>12}",
            "-" * 65
        ]
        b, g = m["baseline"], m["graphrag"]
        for name, key in [("Avg F1 Score", "avg_f1"), ("Avg Exact Match", "avg_em"),
                          ("Avg Context Hit Rate", "avg_context_hit")]:
            bv, gv = b[key], g[key]
            winner = "GraphRAG" if gv > bv else ("Baseline" if bv > gv else "Tie")
            lines.append(f"{name:<25} {bv:>12.4f} {gv:>12.4f} {winner:>12}")

        lines.append(f"\n{'Metric':<25} {'Baseline':>12} {'GraphRAG':>12} {'Ratio':>12}")
        lines.append("-" * 65)
        for name, key in [("Avg Tokens/Query", "avg_tokens"), ("Avg Cost ($)", "avg_cost"),
                          ("Avg Latency (ms)", "avg_latency_ms")]:
            bv, gv = b[key], g[key]
            ratio = gv / bv if bv > 0 else 0
            lines.append(f"{name:<25} {bv:>12.4f} {gv:>12.4f} {ratio:>11.2f}x")

        lines.append(f"\nGraphRAG F1 Win Rate: {m['graphrag_f1_win_rate']:.1%}")
        lines.append(f"Token Ratio (G/B): {m['token_ratio']:.2f}x")

        if m.get("by_question_type"):
            lines.extend(["\n--- By Question Type ---",
                          f"{'Type':<20} {'Count':>6} {'Base F1':>10} {'Graph F1':>10}", "-" * 50])
            for qt, d in m["by_question_type"].items():
                lines.append(f"{qt:<20} {d['count']:>6} {d['baseline_avg_f1']:>10.4f} {d['graphrag_avg_f1']:>10.4f}")
        lines.append("\n" + "=" * 60)
        return "\n".join(lines)
