# 🔍 GraphRAG Inference Hackathon — Dual Pipeline System

<div align="center">

[![TigerGraph](https://img.shields.io/badge/Graph_DB-TigerGraph-FF6B00?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNGRjZCMDAiLz48L3N2Zz4=)](https://www.tigergraph.com/)
[![14 Novelties](https://img.shields.io/badge/Novelties-14_Techniques-002B49?style=for-the-badge)](#-14-novel-techniques)
[![12 LLMs](https://img.shields.io/badge/LLMs-12_Providers-0072CE?style=for-the-badge)](#-12-llm-providers)
[![12 Papers](https://img.shields.io/badge/Papers-12_Cited-cc785c?style=for-the-badge)](#-references--citation-graph)
[![55 Tests](https://img.shields.io/badge/Tests-55_Passing-5db872?style=for-the-badge)](#-testing)
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](#-deployment)

**Proving that graphs make LLM inference faster, cheaper, and smarter — backed by 12 research papers and 6 novel retrieval techniques.**

[Architecture](#-architecture-ai-factory--4-layers) · [Novelties](#-14-novel-techniques) · [Evaluation](#-evaluation-framework) · [Quick Start](#-quick-start) · [Benchmarks](#-expected-benchmarks) · [Papers](#-references--citation-graph)

</div>

---

## 📋 Table of Contents

- [What This Is](#-what-this-is)
- [The Problem We're Solving](#-the-problem-were-solving)
- [Architecture (AI Factory — 4 Layers)](#-architecture-ai-factory--4-layers)
- [14 Novel Techniques](#-14-novel-techniques)
- [Graph Schema & GSQL Queries](#-graph-schema--gsql-queries)
- [Evaluation Framework](#-evaluation-framework)
- [12 LLM Providers](#-12-llm-providers)
- [Expected Benchmarks](#-expected-benchmarks)
- [Quick Start](#-quick-start)
- [Deployment](#-deployment)
- [OpenClaw Agent Integration](#-openclaw-agent-integration)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [References & Citation Graph](#-references--citation-graph)

---

## 🎯 What This Is

A **3-pipeline GraphRAG benchmarking system** with **14 novel techniques** from cutting-edge 2024–2025 research, **12 LLM providers** (including free Ollama local), **OpenClaw agent integration**, and a **production Next.js + Gradio dashboard** — all built on TigerGraph for the [GraphRAG Inference Hackathon](https://www.tigergraph.com/).

| Pipeline 1 (LLM-Only) | Pipeline 2 (Basic RAG) | Pipeline 3 (GraphRAG) |
|---|---|---|
| Query → LLM → Answer | Query → Embed → Top-K Chunks → LLM → Answer | Query → **PolyG Router** → **PPR Scoring** → **Spreading Activation** → **Path Pruning** → **Token Budget** → LLM → Answer |
| No retrieval. Worst-case baseline. | Vector embeddings. Industry standard. | Graph-enhanced, cost-controlled. |

**The headline metric**: token reduction with maintained accuracy. GraphRAG community summaries achieve **26–97% fewer tokens vs full-text summarization** ([Edge et al., 2024](https://arxiv.org/abs/2404.16130)) while delivering **72–83% comprehensiveness win rate** over vector RAG (p < .001).

---

## 🧩 The Problem We're Solving

LLMs burn through thousands of tokens to answer complex questions. At scale, that gets expensive fast:

| Challenge | Vector RAG (Baseline) | GraphRAG (Our Approach) |
|---|---|---|
| **Multi-hop reasoning** | ❌ Retrieves *similar* chunks but can't chain facts across documents | ✅ Traverses entity relationships: `Einstein →BORN_IN→ Germany, Newton →BORN_IN→ England` |
| **Context efficiency** | 🟡 Top-K chunks (~3,600 tokens per query, [Han et al., 2025](https://arxiv.org/abs/2502.11371)) | ✅ Token Budget Controller caps at 2,000 tokens — **97% reduction** vs unbounded retrieval ([TERAG](https://arxiv.org/abs/2509.18667)) |
| **Global sensemaking** | ❌ Can't answer "What are the main themes across 1M tokens?" | ✅ Community-level summaries via Leiden hierarchical detection ([GraphRAG](https://arxiv.org/abs/2404.16130)) |
| **Temporal reasoning** | ❌ 30.7% accuracy on time-dependent queries | ✅ **50.6% accuracy** (+64% improvement, [Han et al., 2025](https://arxiv.org/abs/2502.11371)) |
| **Complex reasoning** | 41.35% accuracy on novel corpus | ✅ **50.93% accuracy** (+23%, [GraphRAG-Bench](https://arxiv.org/abs/2506.05690)) |

### ⚠️ Nuance: The Token Story

The token efficiency claim has two distinct dimensions that the literature separates clearly:

| Comparison | What the Data Shows | Source |
|---|---|---|
| **GraphRAG vs. Full-Text Summarization** | C0 (root communities) uses **97% fewer tokens**; C3 uses **26–33% fewer** | [Edge et al., Table 2](https://arxiv.org/abs/2404.16130) |
| **GraphRAG vs. Top-K Vector RAG** | Community-GraphRAG retrieves ~2.7× MORE tokens (9,770 vs 3,631) | [Han et al., 2025](https://arxiv.org/abs/2502.11371) |
| **With Token Budget Controller** | TERAG achieves **97% token reduction at 80%+ accuracy** vs unbounded | [TERAG, 2024](https://arxiv.org/abs/2509.18667) |

**Our approach**: We use the Token Budget Controller (Novelty #4) to cap GraphRAG context at 2,000 tokens, combining the *structural advantage* of graph reasoning with the *cost advantage* of bounded context. This gives us both better answers AND controlled token cost.

---

## 🏗️ Architecture (AI Factory — 4 Layers)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: EVALUATION                                                          │
│  ┌─────────────────┬──────────────────┬──────────────────┬────────────────┐  │
│  │ LLM-as-a-Judge  │ BERTScore F1     │ RAGAS            │ Token Tracking │  │
│  │ (PASS/FAIL)     │ (≥0.55 rescaled) │ (Faithfulness,   │ (per-query)    │  │
│  │ Target: ≥90%    │ (≥0.88 raw)      │  Relevancy)      │                │  │
│  └─────────────────┴──────────────────┴──────────────────┴────────────────┘  │
│  F1/EM (SQuAD) │ Context Hit Rate │ Live Benchmark │ Next.js Dashboard       │
├──────────────────────────────────────────────────────────────────────────────┤
│  LAYER 3: UNIVERSAL LLM (12 Providers via LiteLLM)                            │
│  OpenAI │ Claude │ Gemini │ Mistral │ Ollama │ Groq │ DeepSeek │ xAI │ …     │
│  Single interface: model routing, cost tracking, fallback chains              │
├──────────────────────────────────────────────────────────────────────────────┤
│  LAYER 2: INFERENCE ORCHESTRATION + NOVELTY ENGINE                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Pipeline 1: LLM-Only (query → LLM → answer, no retrieval)            │  │
│  │ Pipeline 2: Baseline RAG (query → embed → vector top-K → LLM)        │  │
│  │ Pipeline 3: GraphRAG (novelty-enhanced, see below)                    │  │
│  │   PolyG Router → PPR Scoring → Spreading Activation →                │  │
│  │   Path Pruning → Token Budget → Structured Context → LLM             │  │
│  │ Adaptive Router: complexity scorer 0.0–1.0 → route to optimal pipe   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│  LAYER 1: GRAPH (TigerGraph via pyTigerGraph ≥1.6)                            │
│  GSQL: PPR │ Shortest Paths │ Spreading Activation │ Vector Search            │
│  Schema: Document → Chunk → Entity → Community (Leiden hierarchy)             │
│  Incremental Updates (O(new) cost) │ Schema-Bounded Extraction (9 types)      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### How Pipeline 3 (GraphRAG) Processes a Query

```
Query: "Were Einstein and Newton of the same nationality?"

Step 1: PolyG Router → classifies as "multi_hop" (score=0.7) → graph_traversal strategy
Step 2: Dual-level keyword extraction (LightRAG-inspired)
        → high_level: ["nationality", "comparison"]
        → low_level: ["Einstein", "Newton"]
Step 3: Vector search → seed entities [Einstein, Newton] from TigerGraph
Step 4: PPR from seeds → score all reachable entities by graph proximity
Step 5: Spreading Activation → expand to 2-hop neighborhood with decay=0.7
Step 6: Combined scoring: 0.6 × PPR + 0.4 × Activation per chunk
Step 7: Token Budget Controller → select top chunks within 2,000 tokens (prune 60%+)
Step 8: Path Serialization → "Einstein →BORN_IN→ Germany, Newton →BORN_IN→ England"
        (high-reliability paths placed FIRST — exploits lost-in-the-middle bias)
Step 9: LLM generates answer with ranked, pruned, path-structured graph context

Result: "No. Einstein was born in Germany and Newton was born in England."
        Tokens used: 1,847 (vs 3,600+ for vector RAG, vs 12,000+ for LLM-only)
```

---

## 🌟 14 Novel Techniques

### Graph Retrieval Innovations (from 6 papers)

| # | Technique | Paper | Key Result | Implementation |
|---|-----------|-------|------------|----------------|
| 1 | **PPR Confidence-Weighted Retrieval** | [CatRAG](https://arxiv.org/abs/2602.01965) (Feb 2025) | Best reasoning completeness on 4 benchmarks | `PPRConfidenceScorer` — Personalized PageRank from seed entities with damping=0.85, power iteration convergence |
| 2 | **Spreading Activation Context Scoring** | [SA-RAG](https://arxiv.org/abs/2512.15922) (Dec 2024) | **+39% answer correctness** on MuSiQue | `SpreadingActivation` — propagates signal through graph edges with decay=0.7, ranks chunks by accumulated activation |
| 3 | **Flow-Pruned Path Serialization** | [PathRAG](https://arxiv.org/abs/2502.14902) (Feb 2025) | **62–65% win rate** vs LightRAG | `PathPruner` — DFS path discovery, multiplicative edge-weight scoring, threshold pruning, lost-in-the-middle exploit |
| 4 | **Graph Token Budget Controller** | [TERAG](https://arxiv.org/abs/2509.18667) (Sep 2024) | **97% token reduction** at 80%+ accuracy | `TokenBudgetController` — caps context at configurable token limit, prioritizes by score × relevance |
| 5 | **PolyG Hybrid Retrieval Router** | [RAGRouter-Bench](https://arxiv.org/abs/2602.00296) (Feb 2025) | Adaptive > any fixed paradigm | `PolyGRouter` — 4-class query taxonomy → optimal retrieval strategy per query |
| 6 | **Incremental Graph Updates** | [TG-RAG](https://arxiv.org/abs/2510.13590) (Oct 2024) | O(new) vs O(all) recomputation | `IncrementalGraphUpdater` — embedding-similarity entity merging, scoped community re-detection |

### Architecture Innovations

| # | Technique | Inspiration | Description |
|---|-----------|-------------|-------------|
| 7 | **Schema-Bounded Entity Extraction** | [Youtu-GraphRAG](https://arxiv.org/abs/2508.19855) (Tencent, 2025) | 9 entity types (PERSON, ORG, LOCATION, EVENT, DATE, CONCEPT, WORK, PRODUCT, TECHNOLOGY) + 10 relation types → ~90% extraction cost reduction, +16% accuracy vs unconstrained extraction |
| 8 | **Dual-Level Keyword Retrieval** | [LightRAG](https://arxiv.org/abs/2410.05779) (Oct 2024, 34K⭐) | High-level (themes/topics) + low-level (entities/names) keywords for dual-channel retrieval |
| 9 | **Adaptive Query Complexity Router** | Original | LLM scores query complexity 0.0–1.0 → routes simple queries to baseline (saves cost), complex to GraphRAG (better accuracy) |
| 10 | **Graph Reasoning Path Explanation** | Original | Natural language step-by-step traversal explanation: Entry → Traversal → Evidence → Conclusion |

### System Innovations

| # | Technique | Description |
|---|-----------|-------------|
| 11 | **12-Provider Universal LLM** | Single interface for OpenAI, Claude, Gemini, Mistral, Ollama, Groq, DeepSeek, xAI, Together, Cohere, HuggingFace, OpenRouter — with cost tracking and fallback chains |
| 12 | **OpenClaw Agent Skills** | GraphRAG as autonomous agent capabilities following the CIK model (SOUL + IDENTITY + MEMORY + Skills) |
| 13 | **Live Dashboard Benchmarking** | Interactive comparison: one query → all 3 pipelines run → side-by-side responses + metrics. "Run Benchmark Now" button evaluates on HotpotQA in real-time |
| 14 | **Advanced GSQL Queries** | PPR, shortest paths, spreading activation, neighborhood extraction — all as installable TigerGraph queries via `gsql_advanced.py` |

---

## 📐 Graph Schema & GSQL Queries

### TigerGraph Schema

```
┌──────────┐   PART_OF    ┌──────────┐   MENTIONS    ┌──────────┐
│ Document │ ←─────────── │  Chunk   │ ─────────────→ │  Entity  │
│          │  (position)  │          │ (count, conf)  │          │
│ doc_id   │              │ chunk_id │                │ entity_id│
│ title    │              │ text     │                │ name     │
│ content  │              │ embedding│  RELATED_TO    │ type     │
│ source   │              │ tokens   │ ←───────────→  │ desc     │
└──────────┘              └──────────┘ (type, weight) │ embedding│
                                                       └────┬─────┘
                                                            │ IN_COMMUNITY
                                                       ┌────▼─────┐
                                                       │ Community│
                                                       │ comm_id  │
                                                       │ summary  │
                                                       │ level    │
                                                       └──────────┘
```

### Installed GSQL Queries

| Query | Parameters | Purpose |
|---|---|---|
| `vectorSearchChunks` | `queryVec LIST<DOUBLE>, topK INT` | Cosine similarity chunk retrieval |
| `vectorSearchEntities` | `queryVec LIST<DOUBLE>, topK INT` | Entity vector search for seed discovery |
| `graphRAGTraverse` | `seedEntityIds SET<STRING>, hops INT` | Multi-hop neighborhood expansion |
| `pprFromSeeds` | `seedEntityIds, damping FLOAT, maxIter INT` | Personalized PageRank (Novelty #1) |
| `findReasoningPaths` | `sourceId, targetId STRING, maxDepth INT` | Shortest path between entities (Novelty #3) |
| `spreadingActivation` | `seedEntityIds, decayFactor, maxSteps, threshold` | Activation propagation (Novelty #2) |
| `getEntityNeighborhood` | `entityIds SET<STRING>, hops INT` | Subgraph extraction for context building |

---

## 📊 Evaluation Framework

This system implements the full evaluation stack required by the hackathon, grounded in established evaluation literature.

### Metric 1: LLM-as-a-Judge (PASS/FAIL)

**Target: ≥ 90% pass rate** (Hackathon bonus threshold)

Based on the methodology from [Zheng et al., NeurIPS 2023](https://arxiv.org/abs/2306.05685), using **single-answer reference-guided grading** — the most reliable LLM judge configuration (versus pairwise, which has position bias).

**Best practices implemented:**
- ✅ Reference answer always provided (maximizes human correlation per [Prometheus 2](https://arxiv.org/abs/2405.01535))
- ✅ Chain-of-thought before verdict (Explain-then-Rate improves alignment per [survey](https://arxiv.org/abs/2412.05579))
- ✅ Structured JSON output: `{"feedback": "...", "verdict": "PASS"|"FAIL"}`
- ✅ Temperature = 0 for deterministic grading
- ✅ Anti-self-enhancement: judge model ≠ generation model (GPT-4 self-favors 10%, Claude 25% — [Zheng et al.](https://arxiv.org/abs/2306.05685))

**Recommended judge models (free):**
| Model | HF ID | Why |
|---|---|---|
| Prometheus 2 (7B) | `prometheus-eval/prometheus-2-7b-v2.0` | Best open-source judge, Apache 2.0, GPT-4-comparable correlation |
| Llama 3.1 8B Instruct | `meta-llama/Llama-3.1-8B-Instruct` | Strong CoT, good at structured output |

### Metric 2: BERTScore (Semantic Similarity)

**Targets: F1 rescaled ≥ 0.55 OR F1 raw ≥ 0.88** (equivalent thresholds)

Based on [Zhang et al., ICLR 2020](https://arxiv.org/abs/1904.09675). BERTScore computes token-level semantic similarity using contextual embeddings with greedy cosine matching:

```
P_BERT = (1/|x̂|) × Σ max cosine(xi, x̂j)     ← candidate faithfulness
R_BERT = (1/|x|)  × Σ max cosine(xi, x̂j)     ← reference coverage
F_BERT = harmonic_mean(P, R)                    ← primary metric
```

**Why the thresholds are equivalent:** Raw scores with `roberta-large` cluster in 0.84–0.96 (inflated by learned geometry). Rescaling maps against a random-baseline lower bound (`b ≈ 0.84`), so raw ≥ 0.88 ≈ rescaled ≥ 0.55 for English. This represents "semantically similar" text — not identical, but capturing the same meaning.

| Raw F1 | Rescaled F1 | Interpretation |
|---|---|---|
| < 0.84 | ~0 | Poor — nearly unrelated |
| 0.84–0.87 | 0.0–0.45 | Weak — partial overlap |
| **≥ 0.88** | **≥ 0.55** | **✅ Hackathon PASS — semantically similar** |
| 0.90–0.92 | 0.65–0.75 | Good — high semantic match |
| ≥ 0.95 | ≥ 0.88 | Near-paraphrase quality |

**Usage:**
```python
from evaluate import load
bertscore = load("bertscore")
results = bertscore.compute(
    predictions=candidates, references=references,
    model_type="roberta-large", rescale_with_baseline=True, lang="en"
)
# results["f1"][i] >= 0.55 → PASS for sample i
```

### Metric 3: RAGAS (Component Diagnostics)

[RAGAS](https://arxiv.org/abs/2309.15217) provides **reference-free, LLM-powered** evaluation of individual RAG components:

| RAGAS Metric | What It Catches | Formula |
|---|---|---|
| **Faithfulness** | Hallucinations — statements not grounded in context | `|verified_statements| / |total_statements|` |
| **Answer Relevancy** | Off-topic or incomplete answers | `avg cosine_sim(query, generated_questions_from_answer)` |
| **Context Precision** | Retrieval noise — irrelevant chunks returned | Precision of relevant retrieved contexts |
| **Context Recall** | Missing knowledge — relevant info not retrieved | Coverage of reference by retrieved contexts |

### Metric 4: Custom Metrics (No LLM Dependency)

| Metric | Description | Standard |
|---|---|---|
| **F1 Score** | Token-level F1 vs gold answer | SQuAD/HotpotQA |
| **Exact Match** | Normalized string match | SQuAD/HotpotQA |
| **Context Hit Rate** | Fraction of supporting facts found in retrieved contexts | Custom |
| **Token Efficiency** | `graphrag_tokens / baseline_tokens` ratio | Custom |
| **Cost per Query** | `tokens × provider_pricing` | Custom |
| **Response Latency** | End-to-end ms from question to answer | Custom |

### Evaluation Code Path

```python
from graphrag.layers.evaluation_layer import EvaluationLayer, EvalSample

evaluator = EvaluationLayer(eval_llm_model="gpt-4o-mini")
evaluator.initialize()  # loads RAGAS if available

sample = EvalSample(
    query="Were Einstein and Newton of the same nationality?",
    reference_answer="No, Einstein was German and Newton was English.",
    baseline_answer="They were both scientists.",
    graphrag_answer="No. Einstein was born in Germany while Newton was born in England.",
    supporting_facts=["Einstein was born in Ulm, Germany", "Newton was born in Woolsthorpe, England"]
)

result = evaluator.evaluate_sample(sample, baseline_tokens=800, graphrag_tokens=1847)
report = evaluator.generate_report()
```

---

## 🤖 12 LLM Providers

All providers unified through a single `UniversalLLM` interface with automatic detection, cost tracking, and fallback chains.

| Provider | Model | Cost (per 1K tokens) | Speed | Free Tier |
|----------|-------|------|-------|-----------|
| **Ollama** 🦙 | llama3.2 | **$0.00** | ⚡ Local | ✅ Unlimited |
| **HuggingFace** | Llama 3.3 70B | **$0.00** | 🔵 Medium | ✅ Rate-limited |
| **DeepSeek** | DeepSeek V3 | $0.00014 | ⚡ Fast | ✅ Generous |
| **Gemini** | 2.0 Flash | $0.0001 | ⚡ Fast | ✅ Generous |
| **OpenAI** | GPT-4o-mini | $0.00015 | ⚡ Fast | 🟡 Trial credits |
| **Groq** | Llama 3.3 70B | $0.0006 | ⚡⚡ Blazing | ✅ Free tier |
| **Together** | Llama 3.1 70B | $0.0009 | ⚡ Fast | 🟡 Trial credits |
| **Mistral** | Large | $0.002 | 🔵 Medium | 🟡 Trial credits |
| **Cohere** | Command R+ | $0.0025 | 🔵 Medium | ✅ Trial |
| **Anthropic** | Claude Sonnet 4 | $0.003 | 🔵 Medium | 🟡 Trial credits |
| **xAI** | Grok 3 | $0.003 | 🔵 Medium | 🟡 Trial credits |
| **OpenRouter** | 200+ models | Varies | Varies | 🟡 Trial credits |

**Zero-cost hackathon setup:** Ollama (local, unlimited) + Gemini free tier + HuggingFace Inference API = full 3-pipeline benchmarking at $0.

---

## 📈 Expected Benchmarks

### Pipeline Comparison (HotpotQA)

| Metric | Pipeline 1 (LLM-Only) | Pipeline 2 (Basic RAG) | Pipeline 3 (GraphRAG) | GraphRAG vs Basic RAG |
|--------|----------------------|----------------------|---------------------|----------------------|
| **F1 Score** | ~0.30–0.40 | ~0.45–0.60 | ~0.55–0.70 | **+13–21%** ✅ |
| **Exact Match** | ~0.15–0.25 | ~0.30–0.45 | ~0.35–0.50 | **+11%** ✅ |
| **Tokens/Query** | ~2,000–12,000+ | ~800–1,000 | ~1,200–2,000* | bounded by budget |
| **Win Rate** | — | — | ~55–70% | ✅ GraphRAG |

*\*With Token Budget Controller (Novelty #4), GraphRAG context is capped at 2,000 tokens.*

### By Question Type (Literature-Backed Predictions)

| Question Type | Basic RAG F1 | GraphRAG F1 | Δ | Evidence |
|---|---|---|---|---|
| **Bridge** (multi-hop) | ~0.52 | ~0.63 | **+21%** | Graph traversal connects cross-document facts |
| **Comparison** | ~0.58 | ~0.61 | +5% | Entity-pair paths provide structured comparison context |
| **Temporal** | ~0.31 | ~0.51 | **+64%** | [Han et al., 2025](https://arxiv.org/abs/2502.11371) Table 32 |
| **Summarization** | ~0.45 | ~0.51 | **+23%** | [GraphRAG-Bench](https://arxiv.org/abs/2506.05690) on novel corpus |
| **Simple Factoid** | ~0.65 | ~0.63 | −3% | Vector RAG is faster/cheaper for single-hop (router handles this) |

### Token Efficiency Claims (With Citations)

| Claim | Number | Source | Context |
|---|---|---|---|
| GraphRAG comprehensiveness win rate | 72–83% | [Edge et al., 2024](https://arxiv.org/abs/2404.16130), Appendix G, p < .001 | vs vector RAG across Podcast (1M tokens) and News (1.7M tokens) corpora |
| Community summaries vs full-text | 26–97% fewer tokens | [Edge et al., 2024](https://arxiv.org/abs/2404.16130), Table 2 | C0 = 97% fewer, C3 = 26–33% fewer |
| Token Budget Controller reduction | 97% at 80%+ accuracy | [TERAG, 2024](https://arxiv.org/abs/2509.18667) | 3–11% of LightRAG's token cost |
| Spreading Activation correctness | +39% | [SA-RAG, 2024](https://arxiv.org/abs/2512.15922) | On MuSiQue multi-hop benchmark |
| Path retrieval win rate | 62–65% | [PathRAG, 2025](https://arxiv.org/abs/2502.14902) | vs LightRAG comprehensiveness |
| Complex reasoning accuracy | +9.58% | [GraphRAG-Bench, 2025](https://arxiv.org/abs/2506.05690), Table 2 | Novel dataset, ACC: 50.93 vs 41.35 |
| ROUGE-L on complex reasoning | +59% | [GraphRAG-Bench, 2025](https://arxiv.org/abs/2506.05690), Table 2 | 24.09 vs 15.12 |

---

## 🚀 Quick Start

### Prerequisites
- Python ≥ 3.10
- TigerGraph Savanna account ([tgcloud.io](https://tgcloud.io)) or Community Edition ([dl.tigergraph.com](https://dl.tigergraph.com))
- At least one LLM API key (or Ollama for free local inference)

### Option A: Next.js Dashboard (Recommended)

```bash
git clone https://huggingface.co/muthuk1/graphrag-inference-hackathon
cd graphrag-inference-hackathon

# Configure environment
cp .env.example .env
# Edit .env: set TG_HOST, TG_PASSWORD, and at least one LLM provider key

# Setup TigerGraph (one-time: creates schema + installs GSQL queries)
pip install -r requirements.txt
python graphrag/setup_tigergraph.py

# Launch Next.js dashboard
cd web && npm install && npm run dev    # → http://localhost:3000
```

### Option B: Docker (One Command)

```bash
docker build -t graphrag .
docker run -p 3000:3000 -p 7860:7860 --env-file .env graphrag
# → Next.js at :3000, Gradio at :7860
```

### Option C: Python CLI

```bash
pip install -r requirements.txt

# Ingest HotpotQA documents into graph
python -m graphrag.main ingest --samples 100

# Run benchmark (HotpotQA evaluation with F1/EM)
python -m graphrag.main benchmark --samples 50 --top-k 5 --hops 2 --output results.json

# Launch Gradio dashboard
python -m graphrag.main dashboard --port 7860 --share

# Quick demo comparison
python -m graphrag.main demo
```

### Option D: Ollama (100% Free, No API Keys)

```bash
# Install Ollama: https://ollama.ai
ollama pull llama3.2

# Set in .env:
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434

cd web && npm install && npm run dev
```

### Key Configuration Parameters

| Parameter | Default | Description | Tuning Guidance |
|---|---|---|---|
| `top_k` | 5 | Chunks/entities from vector search | Higher = more context, more tokens |
| `hops` | 2 | Graph traversal depth | 2–3 optimal; >3 introduces noise |
| `chunk_size` | 1000 | Characters per chunk during ingestion | 600–1000 for most domains |
| `chunk_overlap` | 100 | Overlap between chunks | 10–20% of chunk_size |
| `token_budget` | 2000 | Max tokens in final context | Lower = cheaper, test accuracy impact |
| `damping` | 0.85 | PPR teleportation probability | Standard; lower = more exploration |
| `decay_factor` | 0.7 | Spreading activation propagation | 0.5–0.8; lower = more focused |
| `complexity_threshold` | 0.6 | Router: above = GraphRAG, below = baseline | Tune based on your query distribution |

---

## 🚢 Deployment

### Docker

```dockerfile
# Multi-stage build: Node 20 frontend + Python 3 venv backend
docker build -t graphrag .
docker run -p 3000:3000 -p 7860:7860 \
  -e TG_HOST=https://YOUR_SUBDOMAIN.tgcloud.io \
  -e TG_PASSWORD=your_password \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  graphrag
```

### Environment Variables

```bash
# TigerGraph (required)
TG_HOST=https://YOUR_SUBDOMAIN.tgcloud.io
TG_GRAPH=GraphRAG
TG_USERNAME=tigergraph
TG_PASSWORD=                    # required

# LLM (set any — auto-detected)
OPENAI_API_KEY=sk-...           # GPT-4o, GPT-4o-mini
ANTHROPIC_API_KEY=sk-ant-...    # Claude Sonnet 4
GEMINI_API_KEY=AIza...          # Gemini 2.0 Flash
OLLAMA_BASE_URL=http://localhost:11434  # Free local

# Defaults
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-20250514
DASHBOARD_PORT=7860
```

### TigerGraph MCP Integration

Connect TigerGraph directly to AI coding tools (Cursor, VS Code Copilot) — build with natural language instead of GSQL:

```json
{
  "mcpServers": {
    "tigergraph": {
      "command": "uvx",
      "args": ["pyTigerGraph-mcp"],
      "env": {
        "TG_HOST": "https://yoursubdomain.tgcloud.io",
        "TG_GRAPH": "GraphRAG",
        "TG_USERNAME": "tigergraph",
        "TG_PASSWORD": "your_password"
      }
    }
  }
}
```

---

## 🦞 OpenClaw Agent Integration

GraphRAG capabilities exposed as autonomous agent skills following the CIK (Cognition-Identity-Knowledge) model:

| Component | File | Purpose |
|-----------|------|---------|
| `SOUL.md` | `openclaw/SOUL.md` | Agent identity, values, operational boundaries |
| `IDENTITY.md` | `openclaw/IDENTITY.md` | Provider config, graph schema awareness, channels |
| `MEMORY.md` | `openclaw/MEMORY.md` | Learned performance knowledge across runs |
| `graph_query` | `openclaw/skills/graph_query/` | Natural language → knowledge graph traversal |
| `compare_pipelines` | `openclaw/skills/compare_pipelines/` | Dual-pipeline comparison with metrics |
| `cost_estimate` | `openclaw/skills/cost_estimate/` | 12-provider cost projection and optimization |

---

## 🧪 Testing

```bash
python tests/test_core.py        # 31 tests — core pipeline functions
python tests/test_novelties.py   # 24 tests — all 6 novelty techniques

# Total: 55 tests covering:
# - PPR convergence, damping, seed weighting
# - Spreading activation decay, threshold, multi-hop
# - PolyG query classification (entity/relation/multi-hop/summarization)
# - Path finding, pruning, serialization
# - Token budget controller, utilization tracking
# - F1/EM computation, context hit rate
# - Incremental graph update planning
```

---

## 📁 Project Structure

```
├── graphrag/                           # Python backend (Layer 1–4)
│   ├── layers/
│   │   ├── graph_layer.py              # Layer 1: TigerGraph connection + GSQL
│   │   ├── gsql_advanced.py            # Layer 1: PPR, paths, activation queries
│   │   ├── orchestration_layer.py      # Layer 2: 3-pipeline routing + comparison
│   │   ├── novelties.py                # Layer 2: 🌟 6 novel techniques engine
│   │   ├── llm_layer.py               # Layer 3: LLM interactions + prompts
│   │   ├── universal_llm.py           # Layer 3: 12-provider unified client
│   │   └── evaluation_layer.py        # Layer 4: RAGAS + F1/EM + BERTScore
│   ├── configs/settings.py             # Configuration management
│   ├── benchmark.py                    # HotpotQA benchmark runner
│   ├── dashboard.py                    # Gradio dashboard (port 7860)
│   ├── ingestion.py                    # Document → Graph ingestion pipeline
│   ├── setup_tigergraph.py             # One-time schema + query installation
│   └── main.py                         # CLI entry point
│
├── web/                                # Next.js 15 Dashboard (port 3000)
│   ├── src/app/api/
│   │   ├── compare/route.ts            # Multi-provider 3-pipeline comparison API
│   │   ├── benchmark/route.ts          # Live benchmark with F1/EM/tokens
│   │   └── providers/route.ts          # Provider health checking
│   ├── src/components/
│   │   ├── tabs/LiveCompare.tsx        # Side-by-side pipeline comparison
│   │   ├── tabs/Benchmark.tsx          # "Run Benchmark Now" + charts
│   │   ├── tabs/CostAnalysis.tsx       # 12-provider cost projections
│   │   └── tabs/GraphExplorer.tsx      # Interactive graph visualization
│   └── src/lib/
│       ├── llm-providers.ts            # 12-provider universal client (TS)
│       └── design-tokens.ts            # TigerGraph design system tokens
│
├── openclaw/                           # OpenClaw Agent (CIK model)
│   ├── SOUL.md / IDENTITY.md / MEMORY.md
│   └── skills/                         # graph_query, compare_pipelines, cost_estimate
│
├── tests/
│   ├── test_core.py                    # 31 core tests
│   └── test_novelties.py              # 24 novelty technique tests
│
├── Dockerfile                          # Multi-stage: Node 20 + Python 3
├── requirements.txt                    # Python dependencies
├── .env.example                        # Full configuration template
└── README.md                           # This file
```

---

## 📚 References & Citation Graph

### Directly Implemented (6 papers → novel techniques)

| # | Paper | ArXiv | Key Contribution | Our Implementation |
|---|-------|-------|------------------|--------------------|
| 1 | **CatRAG** — PPR + Dynamic Edge Weighting | [2602.01965](https://arxiv.org/abs/2602.01965) (Feb 2025) | Personalized PageRank for reasoning completeness | `PPRConfidenceScorer` |
| 2 | **SA-RAG** — Spreading Activation Retrieval | [2512.15922](https://arxiv.org/abs/2512.15922) (Dec 2024) | +39% correctness via activation propagation | `SpreadingActivation` |
| 3 | **PathRAG** — Flow-Pruned Path Retrieval | [2502.14902](https://arxiv.org/abs/2502.14902) (Feb 2025) | 62–65% win rate via path serialization | `PathPruner` |
| 4 | **TERAG** — Token-Efficient Graph RAG | [2509.18667](https://arxiv.org/abs/2509.18667) (Sep 2024) | 97% token reduction at 80%+ accuracy | `TokenBudgetController` |
| 5 | **RAGRouter-Bench** — Hybrid Routing | [2602.00296](https://arxiv.org/abs/2602.00296) (Feb 2025) | Adaptive routing > fixed paradigm | `PolyGRouter` |
| 6 | **TG-RAG** — Incremental Temporal Graph | [2510.13590](https://arxiv.org/abs/2510.13590) (Oct 2024) | O(new) incremental updates | `IncrementalGraphUpdater` |

### Architecture Inspiration (4 papers)

| # | Paper | ArXiv | Contribution |
|---|-------|-------|-------------|
| 7 | **GraphRAG** — Microsoft's Community-Based RAG | [2404.16130](https://arxiv.org/abs/2404.16130) (Apr 2024) | Hierarchical Leiden community detection + map-reduce summarization; 72–83% comprehensiveness win rate |
| 8 | **LightRAG** — Dual-Level Retrieval | [2410.05779](https://arxiv.org/abs/2410.05779) (Oct 2024, 34K⭐) | High-level + low-level keyword dual-channel retrieval |
| 9 | **Youtu-GraphRAG** — Schema-Bounded Extraction | [2508.19855](https://arxiv.org/abs/2508.19855) (Tencent, 2025) | Constrained entity types → 90% extraction cost reduction, +16% accuracy |
| 10 | **HippoRAG 2** — PPR + Passage Integration | [2502.14802](https://arxiv.org/abs/2502.14802) (Feb 2025) | Hippocampus-inspired graph, 87.9–90.9% evidence recall on complex questions |

### Evaluation Methodology (2 papers)

| # | Paper | ArXiv | Used For |
|---|-------|-------|----------|
| 11 | **Judging LLM-as-a-Judge** | [2306.05685](https://arxiv.org/abs/2306.05685) (NeurIPS 2023) | LLM judge methodology, bias mitigation |
| 12 | **BERTScore** | [1904.09675](https://arxiv.org/abs/1904.09675) (ICLR 2020) | Token-level semantic similarity metric |

### Benchmarking Evidence

| # | Paper | ArXiv | Key Finding |
|---|-------|-------|------------|
| — | **RAG vs. GraphRAG: Systematic Evaluation** | [2502.11371](https://arxiv.org/abs/2502.11371) (Feb 2025) | Integration improves best single-method by +6.4%; Temporal: GraphRAG 50.6% vs RAG 30.7% |
| — | **GraphRAG-Bench** | [2506.05690](https://arxiv.org/abs/2506.05690) (Jun 2025) | GraphRAG excels on complex reasoning (+9.58% ACC), RAG better on simple factoid |
| — | **GraphRAG Survey** | [2501.13958](https://arxiv.org/abs/2501.13958) (Jan 2025) | Comprehensive taxonomy: Index-Graph vs KG-based; TigerGraph architecture comparison |

### Citation Flow

```
Microsoft GraphRAG (2404.16130) ─── cited by ──→ LightRAG (2410.05779)
         │                                              │
         ├──────── cited by ──→ CatRAG (2602.01965)     ├──→ TERAG (2509.18667)
         ├──────── cited by ──→ PathRAG (2502.14902)    ├──→ TG-RAG (2510.13590)
         ├──────── cited by ──→ SA-RAG (2512.15922)     └──→ RAGRouter-Bench (2602.00296)
         └──────── cited by ──→ GraphRAG-Bench (2506.05690)
                                        │
HippoRAG 2 (2502.14802) ───────────────┘
Youtu-GraphRAG (2508.19855) ── builds on ──→ Microsoft GraphRAG schema-bounded variant
```

### Datasets & Evaluation Frameworks

- [**HotpotQA**](https://arxiv.org/abs/1809.09600) — Multi-hop QA benchmark (bridge + comparison questions)
- [**RAGAS**](https://arxiv.org/abs/2309.15217) — RAG evaluation: Faithfulness, Relevancy, Context Precision/Recall
- [**Prometheus 2**](https://arxiv.org/abs/2405.01535) — Open-source LLM judge (Apache 2.0, GPT-4-comparable)

---

## 🔗 Important Links

| Resource | Link |
|---|---|
| TigerGraph GraphRAG Repo | [github.com/tigergraph/graphrag](https://github.com/tigergraph/graphrag) |
| TigerGraph MCP | [github.com/tigergraph/tigergraph-mcp](https://github.com/tigergraph/tigergraph-mcp) |
| TigerGraph Savanna | [tgcloud.io](https://tgcloud.io) |
| Community Edition | [dl.tigergraph.com](https://dl.tigergraph.com) |
| TigerGraph Docs | [docs.tigergraph.com](https://docs.tigergraph.com) |
| Discord Community | [discord.gg/Djy8xxDR](https://discord.gg/Djy8xxDR) |

---

<div align="center">

### 🏆 Built for the GraphRAG Inference Hackathon by TigerGraph

**14 Novel Techniques** · **12 Research Papers** · **12 LLM Providers** · **55 Unit Tests** · **OpenClaw Agent** · **Docker-Ready**

*Build it. Benchmark it. Prove graph beats tokens.*

**Token reduction with maintained accuracy — that's the whole game.**

</div>
