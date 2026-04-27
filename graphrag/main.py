"""
Main Entry Point — GraphRAG Inference Hackathon
================================================
Run: python -m graphrag.main {dashboard|benchmark|ingest|demo}
"""
import argparse
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="GraphRAG Inference Hackathon — Dual Pipeline System")
    parser.add_argument("command", choices=["dashboard", "benchmark", "ingest", "demo"],
                        help="Command to run")
    parser.add_argument("--port", type=int, default=7860, help="Dashboard port")
    parser.add_argument("--samples", type=int, default=50, help="Number of samples")
    parser.add_argument("--top-k", type=int, default=5, help="Top-K retrieval")
    parser.add_argument("--hops", type=int, default=2, help="Graph traversal hops")
    parser.add_argument("--share", action="store_true", help="Create Gradio share link")
    parser.add_argument("--output", type=str, default="results.json", help="Output file")
    args = parser.parse_args()

    if args.command == "dashboard":
        from graphrag.dashboard import build_dashboard
        demo = build_dashboard()
        demo.launch(server_port=args.port, share=args.share, show_error=True)

    elif args.command == "benchmark":
        run_benchmark(args)
    elif args.command == "ingest":
        run_ingestion(args)
    elif args.command == "demo":
        run_demo(args)


def run_benchmark(args):
    from graphrag.layers.graph_layer import GraphLayer
    from graphrag.layers.llm_layer import LLMLayer
    from graphrag.layers.orchestration_layer import InferenceOrchestrator, EmbeddingManager
    from graphrag.layers.evaluation_layer import EvaluationLayer
    from graphrag.benchmark import BenchmarkRunner

    llm = LLMLayer(api_key=os.getenv("OPENAI_API_KEY", ""), model=os.getenv("LLM_MODEL", "gpt-4o-mini"))
    llm.initialize()
    embedder = EmbeddingManager(provider="openai", model="text-embedding-3-small",
                                 api_key=os.getenv("OPENAI_API_KEY", ""))
    embedder.initialize()
    graph = GraphLayer()
    orchestrator = InferenceOrchestrator(graph_layer=graph, llm_layer=llm, embedder=embedder)
    orchestrator.initialize()
    evaluator = EvaluationLayer(eval_llm_model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
                                 api_key=os.getenv("OPENAI_API_KEY", ""))
    evaluator.initialize()
    runner = BenchmarkRunner(orchestrator, evaluator)

    logger.info(f"Running benchmark with {args.samples} samples...")
    results = runner.run_hotpotqa_benchmark(num_samples=args.samples, top_k=args.top_k, hops=args.hops)
    print("\n" + results["report"])
    runner.save_results(args.output)
    logger.info(f"Results saved to {args.output}")


def run_ingestion(args):
    from graphrag.layers.graph_layer import GraphLayer
    from graphrag.layers.llm_layer import LLMLayer
    from graphrag.layers.orchestration_layer import EmbeddingManager
    from graphrag.ingestion import IngestionPipeline

    graph = GraphLayer(config={"host": os.getenv("TG_HOST", ""), "graphname": os.getenv("TG_GRAPH", "GraphRAG"),
                                "username": os.getenv("TG_USERNAME", "tigergraph"),
                                "password": os.getenv("TG_PASSWORD", "")})
    if not graph.connect():
        logger.error("Failed to connect to TigerGraph. Set TG_HOST, TG_PASSWORD env vars.")
        sys.exit(1)
    graph.create_schema()
    graph.install_queries()

    llm = LLMLayer(api_key=os.getenv("OPENAI_API_KEY", ""), model="gpt-4o-mini")
    llm.initialize()
    embedder = EmbeddingManager(provider="openai", model="text-embedding-3-small")
    embedder.initialize()
    pipeline = IngestionPipeline(graph, llm, embedder)
    stats = pipeline.ingest_hotpotqa(max_docs=args.samples)
    logger.info(f"Ingestion complete: {stats}")


def run_demo(args):
    from graphrag.layers.llm_layer import LLMLayer
    from graphrag.layers.orchestration_layer import InferenceOrchestrator, EmbeddingManager
    from graphrag.layers.graph_layer import GraphLayer
    from graphrag.layers.evaluation_layer import compute_f1

    print("=" * 60)
    print("🔍 GraphRAG Inference Demo")
    print("=" * 60)

    llm = LLMLayer(api_key=os.getenv("OPENAI_API_KEY", ""), model="gpt-4o-mini")
    llm.initialize()
    embedder = EmbeddingManager(provider="openai", model="text-embedding-3-small")
    embedder.initialize()
    graph = GraphLayer()
    orch = InferenceOrchestrator(graph_layer=graph, llm_layer=llm, embedder=embedder)
    orch.initialize()

    queries = [
        "Were Scott Derrickson and Ed Wood of the same nationality?",
        "Which magazine was started first, Arthur's Magazine or First for Women?",
    ]

    for query in queries:
        print(f"\n{'─' * 60}")
        print(f"Query: {query}")
        try:
            from datasets import load_dataset
            ds = load_dataset("hotpotqa/hotpot_qa", "distractor", split="validation", streaming=True)
            for row in ds:
                if query.lower() == row["question"].lower():
                    passages = [f"{t}: {' '.join(s)}"
                                for t, s in zip(row["context"]["title"], row["context"]["sentences"])]
                    comp = orch.run_comparison(query, passages)
                    gold = row["answer"]
                    print(f"\n🔵 Baseline: {comp.baseline.answer}")
                    print(f"   Tokens: {comp.baseline.total_tokens} | Cost: ${comp.baseline.cost_usd:.6f}")
                    print(f"\n🔴 GraphRAG: {comp.graphrag.answer}")
                    print(f"   Tokens: {comp.graphrag.total_tokens} | Cost: ${comp.graphrag.cost_usd:.6f}")
                    print(f"   Entities: {len(comp.graphrag.entities_found)} | Relations: {len(comp.graphrag.relations_traversed)}")
                    print(f"\n📋 Gold: {gold}")
                    print(f"   Baseline F1: {compute_f1(comp.baseline.answer, gold):.4f}")
                    print(f"   GraphRAG F1: {compute_f1(comp.graphrag.answer, gold):.4f}")
                    break
        except Exception as e:
            print(f"Error: {e}")

    print(f"\n{'=' * 60}")
    print("Run 'python -m graphrag.main dashboard' for the full UI!")


if __name__ == "__main__":
    main()
