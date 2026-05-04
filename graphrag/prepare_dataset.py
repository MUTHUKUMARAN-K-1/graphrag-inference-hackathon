"""
Dataset Preparation — 2M+ Token Corpus for GraphRAG Hackathon
==============================================================
Downloads, tokenizes, and ingests a 2M+ token corpus into TigerGraph.

Supported sources (pick one or combine):
  1. Wikipedia (English) — best entity density, CC-BY-SA
  2. arXiv papers (neuralwork/arxiver) — full text, CC-BY-NC-SA
  3. BBC News (RealTimeData/bbc_news_alltime) — events, CC-BY

Usage:
  python graphrag/prepare_dataset.py --source wikipedia --target-tokens 2500000
  python graphrag/prepare_dataset.py --source arxiv --target-tokens 2500000
  python graphrag/prepare_dataset.py --source bbc --target-tokens 2500000
  python graphrag/prepare_dataset.py --source wikipedia --target-tokens 2500000 --ingest
"""
import argparse
import hashlib
import json
import logging
import os
import sys
import time
from typing import Dict, List, Tuple

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def count_tokens(text: str) -> int:
    """Estimate token count. Uses tiktoken if available, otherwise word-based estimate."""
    try:
        import tiktoken
        enc = tiktoken.encoding_for_model("gpt-4o-mini")
        return len(enc.encode(text))
    except ImportError:
        # Rough estimate: 1 token ≈ 0.75 words (English)
        return int(len(text.split()) * 1.33)


def load_wikipedia(target_tokens: int, domain: str = "science") -> List[Dict]:
    """
    Load Wikipedia articles until target token count is reached.

    Domain filters available:
      - "science": physics, chemistry, biology, mathematics, astronomy
      - "history": wars, empires, historical figures, events
      - "politics": countries, politicians, governments, elections
      - "technology": computing, AI, internet, software, engineering
      - "all": no filter (fastest, most diverse)
    """
    from datasets import load_dataset

    logger.info(f"Loading Wikipedia (domain={domain}, target={target_tokens:,} tokens)...")

    domain_keywords = {
        "science": ["physicist", "scientist", "chemist", "biologist", "mathematician",
                    "theory", "equation", "discovery", "experiment", "research",
                    "university", "professor", "nobel", "quantum", "evolution"],
        "history": ["war", "battle", "empire", "dynasty", "revolution", "treaty",
                    "king", "queen", "president", "ancient", "medieval", "colonial"],
        "politics": ["election", "government", "parliament", "president", "minister",
                     "democrat", "republic", "constitution", "legislation", "political"],
        "technology": ["computer", "software", "algorithm", "internet", "artificial",
                       "programming", "engineer", "processor", "database", "network"],
        "all": [],
    }
    keywords = domain_keywords.get(domain, [])

    ds = load_dataset("wikimedia/wikipedia", "20231101.en", split="train", streaming=True)

    documents = []
    total_tokens = 0
    scanned = 0

    for article in ds:
        scanned += 1
        title = article.get("title", "")
        text = article.get("text", "")

        if not text or len(text) < 200:
            continue

        # Domain filter
        if keywords:
            title_lower = title.lower()
            text_lower = text[:2000].lower()  # check first 2000 chars only for speed
            if not any(kw in title_lower or kw in text_lower for kw in keywords):
                if scanned % 1000 == 0:
                    logger.info(f"  Scanned {scanned:,} articles, collected {len(documents)}, "
                                f"tokens: {total_tokens:,}/{target_tokens:,}")
                continue

        tokens = count_tokens(text)
        documents.append({
            "id": hashlib.md5(title.encode()).hexdigest()[:12],
            "title": title,
            "content": text,
            "source": "wikipedia",
            "tokens": tokens,
            "url": article.get("url", ""),
        })
        total_tokens += tokens

        if len(documents) % 100 == 0:
            logger.info(f"  Collected {len(documents)} articles, "
                        f"tokens: {total_tokens:,}/{target_tokens:,} "
                        f"({total_tokens/target_tokens*100:.1f}%)")

        if total_tokens >= target_tokens:
            break

    logger.info(f"✅ Wikipedia: {len(documents)} articles, {total_tokens:,} tokens")
    return documents


def load_arxiv(target_tokens: int) -> List[Dict]:
    """Load arXiv papers with full markdown text from neuralwork/arxiver."""
    from datasets import load_dataset

    logger.info(f"Loading arXiv papers (target={target_tokens:,} tokens)...")
    ds = load_dataset("neuralwork/arxiver", split="train")

    documents = []
    total_tokens = 0

    for i, paper in enumerate(ds):
        text = paper.get("markdown", "")
        if not text or len(text) < 500:
            continue

        title = paper.get("title", f"Paper {i}")
        tokens = count_tokens(text)

        documents.append({
            "id": paper.get("id", hashlib.md5(title.encode()).hexdigest()[:12]),
            "title": title,
            "content": text,
            "source": "arxiv",
            "tokens": tokens,
            "authors": paper.get("authors", ""),
            "published_date": paper.get("published_date", ""),
        })
        total_tokens += tokens

        if len(documents) % 50 == 0:
            logger.info(f"  Collected {len(documents)} papers, "
                        f"tokens: {total_tokens:,}/{target_tokens:,}")

        if total_tokens >= target_tokens:
            break

    logger.info(f"✅ arXiv: {len(documents)} papers, {total_tokens:,} tokens")
    return documents


def load_bbc_news(target_tokens: int, year: str = "2022") -> List[Dict]:
    """Load BBC News articles from RealTimeData/bbc_news_alltime."""
    from datasets import load_dataset, concatenate_datasets

    logger.info(f"Loading BBC News (year={year}, target={target_tokens:,} tokens)...")

    months = [f"{year}-{m:02d}" for m in range(1, 13)]
    all_articles = []

    for month in months:
        try:
            ds = load_dataset("RealTimeData/bbc_news_alltime", month, split="train")
            all_articles.extend([dict(row) for row in ds])
            logger.info(f"  Loaded {month}: {len(ds)} articles (total: {len(all_articles)})")
        except Exception as e:
            logger.warning(f"  {month} not available: {e}")
            continue

    documents = []
    total_tokens = 0

    for article in all_articles:
        text = article.get("content", "")
        if not text or len(text) < 200:
            continue

        title = article.get("title", "Untitled")
        tokens = count_tokens(text)

        documents.append({
            "id": hashlib.md5(f"{title}:{article.get('published_date','')}".encode()).hexdigest()[:12],
            "title": title,
            "content": text,
            "source": "bbc_news",
            "tokens": tokens,
            "section": article.get("section", ""),
            "published_date": article.get("published_date", ""),
        })
        total_tokens += tokens

        if total_tokens >= target_tokens:
            break

    logger.info(f"✅ BBC News: {len(documents)} articles, {total_tokens:,} tokens")
    return documents


def save_dataset(documents: List[Dict], output_dir: str = "dataset"):
    """Save prepared dataset to disk."""
    os.makedirs(output_dir, exist_ok=True)

    # Save as JSONL
    output_path = os.path.join(output_dir, "corpus.jsonl")
    with open(output_path, "w", encoding="utf-8") as f:
        for doc in documents:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")

    # Save metadata
    total_tokens = sum(d["tokens"] for d in documents)
    meta = {
        "num_documents": len(documents),
        "total_tokens": total_tokens,
        "sources": list(set(d["source"] for d in documents)),
        "avg_tokens_per_doc": total_tokens // max(len(documents), 1),
        "meets_2m_minimum": total_tokens >= 2_000_000,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    meta_path = os.path.join(output_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    logger.info(f"\n{'='*60}")
    logger.info(f"DATASET SAVED: {output_path}")
    logger.info(f"  Documents: {len(documents):,}")
    logger.info(f"  Total tokens: {total_tokens:,}")
    logger.info(f"  Meets 2M minimum: {'✅ YES' if total_tokens >= 2_000_000 else '❌ NO'}")
    logger.info(f"  Metadata: {meta_path}")
    logger.info(f"{'='*60}\n")
    return meta


def ingest_to_tigergraph(documents: List[Dict], max_docs: int = None, extract_entities: bool = True):
    """Ingest prepared documents into TigerGraph via the ingestion pipeline."""
    from graphrag.layers.graph_layer import GraphLayer
    from graphrag.layers.llm_layer import LLMLayer
    from graphrag.layers.orchestration_layer import EmbeddingManager
    from graphrag.ingestion import IngestionPipeline

    logger.info("Connecting to TigerGraph...")
    graph = GraphLayer(config={
        "host": os.getenv("TG_HOST", ""),
        "graphname": os.getenv("TG_GRAPH", "GraphRAG"),
        "username": os.getenv("TG_USERNAME", "tigergraph"),
        "password": os.getenv("TG_PASSWORD", ""),
        "token": os.getenv("TG_TOKEN", ""),
    })
    if not graph.connect():
        logger.error("TigerGraph connection failed. Set TG_HOST and TG_PASSWORD.")
        return

    graph.create_schema()
    graph.install_queries()

    llm = LLMLayer(api_key=os.getenv("OPENAI_API_KEY", ""),
                    model=os.getenv("LLM_MODEL", "gpt-4o-mini"))
    llm.initialize()

    embedder = EmbeddingManager()
    embedder.initialize()

    pipeline = IngestionPipeline(graph, llm, embedder)

    docs_to_ingest = documents[:max_docs] if max_docs else documents
    logger.info(f"Ingesting {len(docs_to_ingest)} documents into TigerGraph...")

    custom_docs = [{"id": d["id"], "title": d["title"], "content": d["content"],
                    "source": d["source"]} for d in docs_to_ingest]
    try:
        stats = pipeline.ingest_custom_documents(custom_docs, extract_entities=extract_entities)
    except Exception as e:
        import traceback
        logger.error(f"Ingestion crashed: {e}")
        logger.error(traceback.format_exc())
        return

    logger.info(f"✅ Ingestion complete: {stats}")
    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Prepare 2M+ token dataset for GraphRAG Hackathon")
    parser.add_argument("--source", choices=["wikipedia", "arxiv", "bbc", "combined"],
                        default="wikipedia", help="Dataset source")
    parser.add_argument("--target-tokens", type=int, default=2_500_000,
                        help="Target token count (default: 2.5M for safety margin)")
    parser.add_argument("--domain", default="science",
                        help="Domain filter for Wikipedia (science/history/politics/technology/all)")
    parser.add_argument("--year", default="2022",
                        help="Year for BBC News")
    parser.add_argument("--output-dir", default="dataset",
                        help="Output directory")
    parser.add_argument("--ingest", action="store_true",
                        help="Also ingest into TigerGraph (requires TG_HOST, TG_PASSWORD)")
    parser.add_argument("--max-ingest", type=int, default=None,
                        help="Max docs to ingest (default: all)")
    parser.add_argument("--no-entities", action="store_true",
                        help="Skip LLM entity extraction (faster, free)")
    args = parser.parse_args()

    # Load dataset
    if args.source == "wikipedia":
        documents = load_wikipedia(args.target_tokens, domain=args.domain)
    elif args.source == "arxiv":
        documents = load_arxiv(args.target_tokens)
    elif args.source == "bbc":
        documents = load_bbc_news(args.target_tokens, year=args.year)
    elif args.source == "combined":
        # Mix: 60% Wikipedia + 25% arXiv + 15% BBC
        wiki_target = int(args.target_tokens * 0.6)
        arxiv_target = int(args.target_tokens * 0.25)
        bbc_target = int(args.target_tokens * 0.15)
        documents = (load_wikipedia(wiki_target, domain=args.domain) +
                     load_arxiv(arxiv_target) +
                     load_bbc_news(bbc_target, year=args.year))

    if not documents:
        logger.error("No documents loaded. Check your internet connection.")
        sys.exit(1)

    # Save to disk
    meta = save_dataset(documents, args.output_dir)

    if not meta["meets_2m_minimum"]:
        logger.warning(f"⚠️  Only {meta['total_tokens']:,} tokens. "
                       f"Need {2_000_000 - meta['total_tokens']:,} more. "
                       f"Try --target-tokens {args.target_tokens + 1_000_000}")

    # Ingest into TigerGraph
    if args.ingest:
        ingest_to_tigergraph(documents, max_docs=args.max_ingest,
                             extract_entities=not args.no_entities)


if __name__ == "__main__":
    main()
