"""
Layer 4: Evaluation Layer — RAGAS + LLM-as-a-Judge + BERTScore + Custom Metrics
================================================================================
Computes all hackathon-required evaluation metrics:
  - LLM-as-a-Judge (PASS/FAIL grading) — Zheng et al., NeurIPS 2023
  - BERTScore (semantic similarity) — Zhang et al., ICLR 2020
  - RAGAS (faithfulness, relevancy, context precision/recall)
  - F1/EM (SQuAD/HotpotQA standard)
  - Token efficiency, cost per query, latency
"""
import json
import logging
import re
import string
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

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


# ── LLM-as-a-Judge (PASS/FAIL) ──────────────────────────

LLM_JUDGE_PROMPT = """You are a strict, impartial judge evaluating the factual correctness of an AI assistant's answer to a question, given a reference answer.

###Question:
{question}

###Reference Answer (Ground Truth):
{reference_answer}

###AI System Answer:
{system_answer}

###Evaluation Criteria:
Assess whether the AI System Answer is factually correct and sufficiently complete relative to the Reference Answer. Minor wording differences are acceptable. The core facts must match.

###Instructions:
1. Write brief feedback explaining your judgment (2-3 sentences).
2. Output a final verdict: PASS (answer is correct/complete) or FAIL (answer is wrong, hallucinated, or critically incomplete).
3. Respond ONLY in this JSON format:
{{"feedback": "<your reasoning>", "verdict": "PASS" or "FAIL"}}

###Feedback:"""


def compute_llm_judge(
    question: str,
    reference_answer: str,
    system_answer: str,
    llm_fn=None,
) -> Dict[str, Any]:
    """
    LLM-as-a-Judge: PASS/FAIL grading with explanation.

    Based on: Zheng et al., "Judging LLM-as-a-Judge" (NeurIPS 2023)
    Best practices:
      - Reference answer always provided (maximizes human correlation)
      - Chain-of-thought before verdict (Explain-then-Rate)
      - Structured JSON output
      - Temperature = 0 for deterministic grading

    Args:
        question: The original question
        reference_answer: The gold/ground-truth answer
        system_answer: The answer to evaluate
        llm_fn: Callable that takes messages list and returns LLMResponse

    Returns:
        {"verdict": "PASS"|"FAIL", "feedback": str, "raw_response": str}
    """
    if not system_answer or not system_answer.strip():
        return {"verdict": "FAIL", "feedback": "Empty answer.", "raw_response": ""}

    if not llm_fn:
        # Heuristic fallback: use F1 overlap as a proxy
        f1 = compute_f1(system_answer, reference_answer)
        verdict = "PASS" if f1 >= 0.4 else "FAIL"
        return {
            "verdict": verdict,
            "feedback": f"Heuristic: F1={f1:.3f} (no LLM judge available)",
            "raw_response": "",
        }

    prompt = LLM_JUDGE_PROMPT.format(
        question=question,
        reference_answer=reference_answer,
        system_answer=system_answer,
    )

    try:
        resp = llm_fn([
            {"role": "system", "content": "You are a strict evaluation judge. Respond only in the specified JSON format."},
            {"role": "user", "content": prompt},
        ])
        raw = resp.content if hasattr(resp, "content") else str(resp)

        # Parse JSON verdict
        try:
            data = json.loads(raw)
            verdict = data.get("verdict", "FAIL").upper().strip()
            if verdict not in ("PASS", "FAIL"):
                verdict = "FAIL"
            return {
                "verdict": verdict,
                "feedback": data.get("feedback", ""),
                "raw_response": raw,
            }
        except json.JSONDecodeError:
            # Fallback: regex parse
            match = re.search(r'"verdict"\s*:\s*"(PASS|FAIL)"', raw, re.IGNORECASE)
            if match:
                return {
                    "verdict": match.group(1).upper(),
                    "feedback": raw,
                    "raw_response": raw,
                }
            # Last resort: check for PASS/FAIL anywhere in response
            if "PASS" in raw.upper():
                return {"verdict": "PASS", "feedback": raw, "raw_response": raw}
            return {"verdict": "FAIL", "feedback": raw, "raw_response": raw}
    except Exception as e:
        logger.error(f"LLM-as-Judge error: {e}")
        return {"verdict": "FAIL", "feedback": f"Judge error: {e}", "raw_response": ""}


# ── BERTScore ────────────────────────────────────────────

def compute_bertscore(
    predictions: List[str],
    references: List[str],
    model_type: str = "roberta-large",
    rescale: bool = True,
    lang: str = "en",
) -> Dict[str, Any]:
    """
    Compute BERTScore F1 for a batch of prediction/reference pairs.

    Based on: Zhang et al., "BERTScore: Evaluating Text Generation
    with BERT" (ICLR 2020, arxiv:1904.09675)

    Hackathon thresholds:
      - BERTScore F1 rescaled >= 0.55 (bonus)
      - BERTScore F1 raw >= 0.88 (equivalent bonus)

    Args:
        predictions: List of candidate answers
        references: List of reference answers
        model_type: BERTScore model (default: roberta-large)
        rescale: Whether to rescale against baseline (recommended)
        lang: Language code

    Returns:
        {
            "precision": List[float], "recall": List[float], "f1": List[float],
            "mean_f1": float, "pass_rate": float (% samples with f1 >= threshold)
        }
    """
    if not predictions or not references:
        return {"precision": [], "recall": [], "f1": [], "mean_f1": 0.0, "pass_rate": 0.0}

    # Try evaluate library first (HuggingFace)
    try:
        from evaluate import load as eval_load
        bertscore = eval_load("bertscore")
        results = bertscore.compute(
            predictions=predictions,
            references=references,
            model_type=model_type,
            rescale_with_baseline=rescale,
            lang=lang,
        )
        f1_scores = results["f1"]
        threshold = 0.55 if rescale else 0.88
        pass_rate = sum(1 for f in f1_scores if f >= threshold) / len(f1_scores) if f1_scores else 0.0
        return {
            "precision": results["precision"],
            "recall": results["recall"],
            "f1": f1_scores,
            "mean_f1": sum(f1_scores) / len(f1_scores) if f1_scores else 0.0,
            "pass_rate": pass_rate,
            "threshold": threshold,
            "rescaled": rescale,
            "model": model_type,
        }
    except ImportError:
        pass

    # Try bert_score library directly
    try:
        from bert_score import score as bert_score_fn
        P, R, F1 = bert_score_fn(
            cands=predictions, refs=references,
            model_type=model_type,
            rescale_with_baseline=rescale,
            lang=lang, verbose=False,
        )
        f1_list = F1.tolist()
        threshold = 0.55 if rescale else 0.88
        pass_rate = sum(1 for f in f1_list if f >= threshold) / len(f1_list) if f1_list else 0.0
        return {
            "precision": P.tolist(),
            "recall": R.tolist(),
            "f1": f1_list,
            "mean_f1": sum(f1_list) / len(f1_list) if f1_list else 0.0,
            "pass_rate": pass_rate,
            "threshold": threshold,
            "rescaled": rescale,
            "model": model_type,
        }
    except ImportError:
        pass

    # Fallback: use token-level F1 as approximation
    logger.warning("BERTScore not available. Install: pip install evaluate bert-score. Using token F1 proxy.")
    f1_scores = [compute_f1(p, r) for p, r in zip(predictions, references)]
    return {
        "precision": f1_scores,
        "recall": f1_scores,
        "f1": f1_scores,
        "mean_f1": sum(f1_scores) / len(f1_scores) if f1_scores else 0.0,
        "pass_rate": sum(1 for f in f1_scores if f >= 0.5) / len(f1_scores) if f1_scores else 0.0,
        "threshold": 0.5,
        "rescaled": False,
        "model": "token_f1_proxy",
        "warning": "BERTScore not installed — using token F1 as proxy",
    }


# ── Data Structures ───────────────────────────────────────

@dataclass
class EvalSample:
    """Single evaluation sample with all 3 pipelines."""
    query: str = ""
    reference_answer: str = ""
    llm_only_answer: str = ""
    baseline_answer: str = ""
    graphrag_answer: str = ""
    baseline_contexts: List[str] = field(default_factory=list)
    graphrag_contexts: List[str] = field(default_factory=list)
    question_type: str = ""
    difficulty: str = ""
    supporting_facts: List[str] = field(default_factory=list)


@dataclass
class EvalResult:
    """Evaluation result for a single sample across all 3 pipelines."""
    query: str = ""
    # F1 / EM
    llm_only_f1: float = 0.0
    baseline_f1: float = 0.0
    graphrag_f1: float = 0.0
    llm_only_em: float = 0.0
    baseline_em: float = 0.0
    graphrag_em: float = 0.0
    # Context hit rate
    baseline_context_hit: float = 0.0
    graphrag_context_hit: float = 0.0
    # LLM-as-a-Judge
    llm_only_judge: str = ""   # "PASS" or "FAIL"
    baseline_judge: str = ""
    graphrag_judge: str = ""
    # BERTScore F1
    llm_only_bertscore: float = 0.0
    baseline_bertscore: float = 0.0
    graphrag_bertscore: float = 0.0
    # RAGAS
    baseline_faithfulness: float = 0.0
    graphrag_faithfulness: float = 0.0
    baseline_relevancy: float = 0.0
    graphrag_relevancy: float = 0.0
    baseline_context_precision: float = 0.0
    graphrag_context_precision: float = 0.0
    baseline_context_recall: float = 0.0
    graphrag_context_recall: float = 0.0
    # Efficiency metrics
    llm_only_tokens: int = 0
    baseline_tokens: int = 0
    graphrag_tokens: int = 0
    llm_only_cost: float = 0.0
    baseline_cost: float = 0.0
    graphrag_cost: float = 0.0
    llm_only_latency: float = 0.0
    baseline_latency: float = 0.0
    graphrag_latency: float = 0.0
    question_type: str = ""
    difficulty: str = ""


# ── Evaluation Layer ──────────────────────────────────────

class EvaluationLayer:
    """
    Layer 4: Evaluation Layer.
    Computes all hackathon-required metrics:
      - LLM-as-a-Judge (PASS/FAIL) — target >= 90% pass rate
      - BERTScore F1 — target >= 0.55 rescaled / >= 0.88 raw
      - F1, EM, Context Hit Rate
      - RAGAS (optional)
      - Token efficiency, cost, latency
    """

    def __init__(self, eval_llm_model="gpt-4o-mini", api_key=""):
        self.eval_llm_model = eval_llm_model
        self._api_key = api_key
        self._ragas_available = False
        self._bertscore_available = False
        self._llm_judge_fn = None
        self.results: List[EvalResult] = []

    def initialize(self):
        """Initialize RAGAS and BERTScore components if available."""
        try:
            from ragas import evaluate, EvaluationDataset, SingleTurnSample
            from ragas.metrics import Faithfulness, AnswerRelevancy
            self._ragas_available = True
            logger.info("RAGAS evaluation available.")
        except ImportError:
            logger.warning("RAGAS not installed — using custom metrics only.")

        # Check BERTScore availability
        try:
            import evaluate
            self._bertscore_available = True
            logger.info("BERTScore available via evaluate library.")
        except ImportError:
            try:
                import bert_score
                self._bertscore_available = True
                logger.info("BERTScore available via bert_score library.")
            except ImportError:
                logger.warning("BERTScore not installed. Install: pip install evaluate bert-score")

        # Initialize LLM judge function
        self._init_llm_judge()

    def _init_llm_judge(self):
        """Initialize the LLM judge function."""
        try:
            from openai import OpenAI
            import os
            key = self._api_key or os.getenv("OPENAI_API_KEY", "")
            if key:
                client = OpenAI(api_key=key)
                model = self.eval_llm_model

                def judge_fn(messages):
                    resp = client.chat.completions.create(
                        model=model, messages=messages,
                        temperature=0, max_tokens=512,
                        response_format={"type": "json_object"},
                    )
                    from .llm_layer import LLMResponse
                    return LLMResponse(
                        content=resp.choices[0].message.content,
                        input_tokens=resp.usage.prompt_tokens,
                        output_tokens=resp.usage.completion_tokens,
                    )

                self._llm_judge_fn = judge_fn
                logger.info(f"LLM-as-Judge initialized with {model}")
        except Exception as e:
            logger.warning(f"LLM-as-Judge not available: {e}")

    def evaluate_sample(
        self, sample: EvalSample,
        llm_only_tokens=0, baseline_tokens=0, graphrag_tokens=0,
        llm_only_cost=0.0, baseline_cost=0.0, graphrag_cost=0.0,
        llm_only_latency=0.0, baseline_latency=0.0, graphrag_latency=0.0,
        run_judge=True, run_bertscore=False,
    ) -> EvalResult:
        """Evaluate a single sample with all metrics across all 3 pipelines."""
        r = EvalResult(
            query=sample.query,
            question_type=sample.question_type,
            difficulty=sample.difficulty,
            # F1
            llm_only_f1=compute_f1(sample.llm_only_answer, sample.reference_answer) if sample.llm_only_answer else 0.0,
            baseline_f1=compute_f1(sample.baseline_answer, sample.reference_answer),
            graphrag_f1=compute_f1(sample.graphrag_answer, sample.reference_answer),
            # EM
            llm_only_em=compute_exact_match(sample.llm_only_answer, sample.reference_answer) if sample.llm_only_answer else 0.0,
            baseline_em=compute_exact_match(sample.baseline_answer, sample.reference_answer),
            graphrag_em=compute_exact_match(sample.graphrag_answer, sample.reference_answer),
            # Context hit
            baseline_context_hit=compute_context_hit_rate(
                sample.baseline_contexts, sample.supporting_facts),
            graphrag_context_hit=compute_context_hit_rate(
                sample.graphrag_contexts, sample.supporting_facts),
            # Efficiency
            llm_only_tokens=llm_only_tokens,
            baseline_tokens=baseline_tokens, graphrag_tokens=graphrag_tokens,
            llm_only_cost=llm_only_cost,
            baseline_cost=baseline_cost, graphrag_cost=graphrag_cost,
            llm_only_latency=llm_only_latency,
            baseline_latency=baseline_latency, graphrag_latency=graphrag_latency,
        )

        # LLM-as-a-Judge
        if run_judge:
            for answer_attr, judge_attr in [
                ("llm_only_answer", "llm_only_judge"),
                ("baseline_answer", "baseline_judge"),
                ("graphrag_answer", "graphrag_judge"),
            ]:
                answer = getattr(sample, answer_attr, "")
                if answer:
                    verdict = compute_llm_judge(
                        sample.query, sample.reference_answer, answer, self._llm_judge_fn
                    )
                    setattr(r, judge_attr, verdict["verdict"])

        self.results.append(r)
        return r

    def evaluate_bertscore_batch(
        self, samples: List[EvalSample], pipeline: str = "graphrag"
    ) -> Dict[str, Any]:
        """Run BERTScore on a batch for a specific pipeline."""
        predictions, references = [], []
        for s in samples:
            if pipeline == "llm_only" and s.llm_only_answer:
                predictions.append(s.llm_only_answer)
                references.append(s.reference_answer)
            elif pipeline == "baseline" and s.baseline_answer:
                predictions.append(s.baseline_answer)
                references.append(s.reference_answer)
            elif pipeline == "graphrag" and s.graphrag_answer:
                predictions.append(s.graphrag_answer)
                references.append(s.reference_answer)

        if not predictions:
            return {"f1": [], "mean_f1": 0.0, "pass_rate": 0.0}
        return compute_bertscore(predictions, references)

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

        lo = {
            "avg_f1": round(avg([r.llm_only_f1 for r in self.results]), 4),
            "avg_em": round(avg([r.llm_only_em for r in self.results]), 4),
            "avg_tokens": round(avg([r.llm_only_tokens for r in self.results]), 1),
            "avg_cost": round(avg([r.llm_only_cost for r in self.results]), 6),
            "avg_latency_ms": round(avg([r.llm_only_latency for r in self.results]), 1),
            "judge_pass_rate": round(
                sum(1 for r in self.results if r.llm_only_judge == "PASS") / max(
                    sum(1 for r in self.results if r.llm_only_judge), 1), 4),
        }
        b = {
            "avg_f1": round(avg([r.baseline_f1 for r in self.results]), 4),
            "avg_em": round(avg([r.baseline_em for r in self.results]), 4),
            "avg_context_hit": round(avg([r.baseline_context_hit for r in self.results]), 4),
            "avg_tokens": round(avg([r.baseline_tokens for r in self.results]), 1),
            "avg_cost": round(avg([r.baseline_cost for r in self.results]), 6),
            "avg_latency_ms": round(avg([r.baseline_latency for r in self.results]), 1),
            "total_tokens": sum(r.baseline_tokens for r in self.results),
            "total_cost": round(sum(r.baseline_cost for r in self.results), 6),
            "judge_pass_rate": round(
                sum(1 for r in self.results if r.baseline_judge == "PASS") / max(
                    sum(1 for r in self.results if r.baseline_judge), 1), 4),
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
            "judge_pass_rate": round(
                sum(1 for r in self.results if r.graphrag_judge == "PASS") / max(
                    sum(1 for r in self.results if r.graphrag_judge), 1), 4),
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
            "num_samples": n,
            "llm_only": lo, "baseline": b, "graphrag": g,
            "graphrag_f1_win_rate": round(win_rate, 4),
            "token_ratio": round(g.get("total_tokens", 0) / max(b.get("total_tokens", 1), 1), 3),
            "by_question_type": {
                qt: {"count": d["count"],
                     "baseline_avg_f1": round(avg(d["baseline_f1"]), 4),
                     "graphrag_avg_f1": round(avg(d["graphrag_f1"]), 4)}
                for qt, d in by_type.items()
            }
        }

    def generate_report(self) -> str:
        """Generate a comprehensive text benchmark report."""
        m = self.compute_aggregate_metrics()
        if "message" in m: return m["message"]
        lines = [
            "=" * 70,
            "GRAPHRAG INFERENCE BENCHMARK REPORT (3-PIPELINE)",
            "=" * 70,
            f"\nTotal Samples Evaluated: {m['num_samples']}",
            f"\n{'Metric':<25} {'LLM-Only':>12} {'Basic RAG':>12} {'GraphRAG':>12} {'Winner':>12}",
            "-" * 78,
        ]
        lo, b, g = m["llm_only"], m["baseline"], m["graphrag"]

        for name, key in [("Avg F1 Score", "avg_f1"), ("Avg Exact Match", "avg_em")]:
            lov, bv, gv = lo.get(key, 0), b[key], g[key]
            best = max(lov, bv, gv)
            winner = "LLM-Only" if lov == best else ("BasicRAG" if bv == best else "GraphRAG")
            lines.append(f"{name:<25} {lov:>12.4f} {bv:>12.4f} {gv:>12.4f} {winner:>12}")

        # LLM-as-a-Judge pass rates
        lines.append(f"\n{'LLM-Judge Pass Rate':<25} {lo.get('judge_pass_rate', 0):>11.1%} "
                     f"{b.get('judge_pass_rate', 0):>12.1%} {g.get('judge_pass_rate', 0):>12.1%}")

        lines.append(f"\n{'Metric':<25} {'LLM-Only':>12} {'Basic RAG':>12} {'GraphRAG':>12} {'Ratio G/B':>12}")
        lines.append("-" * 78)
        for name, key in [("Avg Tokens/Query", "avg_tokens"), ("Avg Cost ($)", "avg_cost"),
                          ("Avg Latency (ms)", "avg_latency_ms")]:
            lov, bv, gv = lo.get(key, 0), b[key], g[key]
            ratio = gv / bv if bv > 0 else 0
            lines.append(f"{name:<25} {lov:>12.4f} {bv:>12.4f} {gv:>12.4f} {ratio:>11.2f}x")

        lines.append(f"\nGraphRAG F1 Win Rate vs Basic RAG: {m['graphrag_f1_win_rate']:.1%}")
        lines.append(f"Token Ratio (GraphRAG/BasicRAG): {m['token_ratio']:.2f}x")

        # Bonus thresholds
        gj = g.get("judge_pass_rate", 0)
        lines.append(f"\n--- Hackathon Bonus Thresholds ---")
        lines.append(f"LLM-Judge Pass Rate (GraphRAG): {gj:.1%} {'✅ BONUS' if gj >= 0.9 else '❌ < 90%'}")

        if m.get("by_question_type"):
            lines.extend(["\n--- By Question Type ---",
                          f"{'Type':<20} {'Count':>6} {'Base F1':>10} {'Graph F1':>10}", "-" * 50])
            for qt, d in m["by_question_type"].items():
                lines.append(f"{qt:<20} {d['count']:>6} {d['baseline_avg_f1']:>10.4f} {d['graphrag_avg_f1']:>10.4f}")
        lines.append("\n" + "=" * 70)
        return "\n".join(lines)
