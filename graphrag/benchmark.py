"""
Benchmark Runner — Runs both pipelines on HotpotQA and evaluates
=================================================================
"""
import json
import logging
from typing import Dict, List
from .layers.orchestration_layer import InferenceOrchestrator
from .layers.evaluation_layer import EvaluationLayer, EvalSample

logger = logging.getLogger(__name__)


class BenchmarkRunner:
    """Runs benchmarks on HotpotQA and generates comparison metrics."""

    def __init__(self, orchestrator, evaluator):
        self.orchestrator = orchestrator
        self.evaluator = evaluator
        self.benchmark_results = []

    def run_hotpotqa_benchmark(self, num_samples=100, split="validation",
                                top_k=5, hops=2, progress_callback=None):
        """Run both pipelines on HotpotQA and evaluate."""
        from datasets import load_dataset
        logger.info(f"Loading HotpotQA ({split}, n={num_samples})...")
        ds = load_dataset("hotpotqa/hotpot_qa", "distractor", split=split)

        results = []
        for idx in range(min(num_samples, len(ds))):
            row = ds[idx]
            query, gold = row["question"], row["answer"]
            qtype = row.get("type", "unknown")
            level = row.get("level", "unknown")

            # Build passages from context
            passages = [f"{t}: {' '.join(s)}"
                        for t, s in zip(row["context"]["title"], row["context"]["sentences"])]

            # Extract supporting facts for context hit rate
            sf = []
            for t, si in zip(row["supporting_facts"]["title"], row["supporting_facts"]["sent_id"]):
                for ct, cs in zip(row["context"]["title"], row["context"]["sentences"]):
                    if ct == t and si < len(cs):
                        sf.append(cs[si])

            try:
                comp = self.orchestrator.run_comparison(query, passages, top_k, hops)

                sample = EvalSample(
                    query=query, reference_answer=gold,
                    baseline_answer=comp.baseline.answer,
                    graphrag_answer=comp.graphrag.answer,
                    baseline_contexts=comp.baseline.contexts,
                    graphrag_contexts=comp.graphrag.contexts,
                    question_type=qtype, difficulty=str(level),
                    supporting_facts=sf)

                er = self.evaluator.evaluate_sample(
                    sample,
                    comp.baseline.total_tokens, comp.graphrag.total_tokens,
                    comp.baseline.cost_usd, comp.graphrag.cost_usd,
                    comp.baseline.latency_ms, comp.graphrag.latency_ms)

                rd = {
                    "idx": idx, "query": query, "gold_answer": gold,
                    "question_type": qtype, "level": level,
                    "baseline_answer": comp.baseline.answer,
                    "graphrag_answer": comp.graphrag.answer,
                    "baseline_f1": er.baseline_f1, "graphrag_f1": er.graphrag_f1,
                    "baseline_em": er.baseline_em, "graphrag_em": er.graphrag_em,
                    "baseline_tokens": comp.baseline.total_tokens,
                    "graphrag_tokens": comp.graphrag.total_tokens,
                    "baseline_cost": comp.baseline.cost_usd,
                    "graphrag_cost": comp.graphrag.cost_usd,
                    "baseline_latency": comp.baseline.latency_ms,
                    "graphrag_latency": comp.graphrag.latency_ms,
                    "baseline_context_hit": er.baseline_context_hit,
                    "graphrag_context_hit": er.graphrag_context_hit,
                    "entities_found": len(comp.graphrag.entities_found),
                    "relations_traversed": len(comp.graphrag.relations_traversed),
                }
                results.append(rd)
                self.benchmark_results.append(rd)

                if progress_callback:
                    progress_callback(idx + 1, num_samples, rd)
                if (idx + 1) % 10 == 0:
                    logger.info(f"Processed {idx + 1}/{num_samples} queries...")

            except Exception as e:
                logger.error(f"Error on query {idx}: {e}")

        aggregate = self.evaluator.compute_aggregate_metrics()
        report = self.evaluator.generate_report()
        return {"results": results, "aggregate": aggregate, "report": report,
                "num_completed": len(results), "num_requested": num_samples}

    def get_results_dataframe(self):
        import pandas as pd
        return pd.DataFrame(self.benchmark_results) if self.benchmark_results else pd.DataFrame()

    def save_results(self, filepath):
        with open(filepath, 'w') as f:
            json.dump({"results": self.benchmark_results,
                       "aggregate": self.evaluator.compute_aggregate_metrics()},
                      f, indent=2, default=str)
