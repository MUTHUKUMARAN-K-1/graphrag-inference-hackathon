"""
Benchmark Runner — Runs all 3 pipelines on HotpotQA and evaluates
==================================================================
Pipeline 1: LLM-Only (no retrieval)
Pipeline 2: Basic RAG (vector search + LLM)
Pipeline 3: GraphRAG (TigerGraph + novelty engine)

Evaluates with: F1, EM, LLM-as-a-Judge, BERTScore, Context Hit Rate
"""
import json
import logging
from typing import Dict, List, Optional
from .layers.orchestration_layer import InferenceOrchestrator
from .layers.evaluation_layer import (
    EvaluationLayer, EvalSample, compute_bertscore
)

logger = logging.getLogger(__name__)


class BenchmarkRunner:
    """Runs benchmarks on HotpotQA with all 3 pipelines and generates comparison metrics."""

    def __init__(self, orchestrator, evaluator):
        self.orchestrator = orchestrator
        self.evaluator = evaluator
        self.benchmark_results = []
        self.eval_samples: List[EvalSample] = []

    def run_hotpotqa_benchmark(self, num_samples=100, split="validation",
                                top_k=5, hops=2, progress_callback=None,
                                run_judge=True, run_bertscore=True):
        """Run all 3 pipelines on HotpotQA and evaluate."""
        from datasets import load_dataset
        logger.info(f"Loading HotpotQA ({split}, n={num_samples})...")
        ds = load_dataset("hotpotqa/hotpot_qa", "distractor", split=split)

        results = []
        self.eval_samples = []

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
                # Run all 3 pipelines
                lo = self.orchestrator.run_llm_only(query)
                b = self.orchestrator.run_baseline_rag(query, passages, top_k)
                g = self.orchestrator.run_graphrag(query, passages, hops=hops)

                sample = EvalSample(
                    query=query, reference_answer=gold,
                    llm_only_answer=lo.answer,
                    baseline_answer=b.answer,
                    graphrag_answer=g.answer,
                    baseline_contexts=b.contexts,
                    graphrag_contexts=g.contexts,
                    question_type=qtype, difficulty=str(level),
                    supporting_facts=sf)
                self.eval_samples.append(sample)

                er = self.evaluator.evaluate_sample(
                    sample,
                    llm_only_tokens=lo.total_tokens,
                    baseline_tokens=b.total_tokens,
                    graphrag_tokens=g.total_tokens,
                    llm_only_cost=lo.cost_usd,
                    baseline_cost=b.cost_usd,
                    graphrag_cost=g.cost_usd,
                    llm_only_latency=lo.latency_ms,
                    baseline_latency=b.latency_ms,
                    graphrag_latency=g.latency_ms,
                    run_judge=run_judge,
                )

                rd = {
                    "idx": idx, "query": query, "gold_answer": gold,
                    "question_type": qtype, "level": level,
                    # Answers
                    "llm_only_answer": lo.answer,
                    "baseline_answer": b.answer,
                    "graphrag_answer": g.answer,
                    # F1 / EM
                    "llm_only_f1": er.llm_only_f1,
                    "baseline_f1": er.baseline_f1,
                    "graphrag_f1": er.graphrag_f1,
                    "llm_only_em": er.llm_only_em,
                    "baseline_em": er.baseline_em,
                    "graphrag_em": er.graphrag_em,
                    # LLM-as-Judge
                    "llm_only_judge": er.llm_only_judge,
                    "baseline_judge": er.baseline_judge,
                    "graphrag_judge": er.graphrag_judge,
                    # Tokens / Cost / Latency
                    "llm_only_tokens": lo.total_tokens,
                    "baseline_tokens": b.total_tokens,
                    "graphrag_tokens": g.total_tokens,
                    "llm_only_cost": lo.cost_usd,
                    "baseline_cost": b.cost_usd,
                    "graphrag_cost": g.cost_usd,
                    "llm_only_latency": lo.latency_ms,
                    "baseline_latency": b.latency_ms,
                    "graphrag_latency": g.latency_ms,
                    # Context
                    "baseline_context_hit": er.baseline_context_hit,
                    "graphrag_context_hit": er.graphrag_context_hit,
                    "entities_found": len(g.entities_found),
                    "relations_traversed": len(g.relations_traversed),
                }
                results.append(rd)
                self.benchmark_results.append(rd)

                if progress_callback:
                    progress_callback(idx + 1, num_samples, rd)
                if (idx + 1) % 10 == 0:
                    logger.info(f"Processed {idx + 1}/{num_samples} queries...")

            except Exception as e:
                logger.error(f"Error on query {idx}: {e}")

        # Run BERTScore on full batch (more efficient than per-sample)
        bertscore_results = {}
        if run_bertscore and self.eval_samples:
            logger.info("Computing BERTScore for all pipelines...")
            for pipe in ["llm_only", "baseline", "graphrag"]:
                try:
                    bs = self.evaluator.evaluate_bertscore_batch(self.eval_samples, pipeline=pipe)
                    bertscore_results[pipe] = bs
                    logger.info(f"  {pipe}: mean_f1={bs.get('mean_f1', 0):.4f}, pass_rate={bs.get('pass_rate', 0):.1%}")
                except Exception as e:
                    logger.warning(f"  BERTScore for {pipe} failed: {e}")

        aggregate = self.evaluator.compute_aggregate_metrics()
        report = self.evaluator.generate_report()
        return {
            "results": results,
            "aggregate": aggregate,
            "bertscore": bertscore_results,
            "report": report,
            "num_completed": len(results),
            "num_requested": num_samples,
        }

    def get_results_dataframe(self):
        import pandas as pd
        return pd.DataFrame(self.benchmark_results) if self.benchmark_results else pd.DataFrame()

    def save_results(self, filepath):
        with open(filepath, 'w') as f:
            json.dump({
                "results": self.benchmark_results,
                "aggregate": self.evaluator.compute_aggregate_metrics(),
            }, f, indent=2, default=str)
