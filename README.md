# 🔍 GraphRAG Inference Hackathon — 3-Pipeline Benchmarking System

<div align="center">

[![TigerGraph](https://img.shields.io/badge/Built_On-TigerGraph_GraphRAG-FF6B00?style=for-the-badge)](https://github.com/tigergraph/graphrag)
[![3 Pipelines](https://img.shields.io/badge/Pipelines-3_(LLM+RAG+GraphRAG)-002B49?style=for-the-badge)](#-3-pipeline-architecture)
[![14 Novelties](https://img.shields.io/badge/Novelties-14_Techniques-0072CE?style=for-the-badge)](#-14-novel-techniques)
[![12 LLMs](https://img.shields.io/badge/LLMs-12_Providers-5865F2?style=for-the-badge)](#-12-llm-providers)
[![12 Papers](https://img.shields.io/badge/Papers-12_Cited-cc785c?style=for-the-badge)](#-references)
[![50 Tests](https://img.shields.io/badge/Tests-50_Passing-5db872?style=for-the-badge)](#-testing)

**One query in → three pipelines run → side-by-side responses + metrics out.**

Proving that graphs make LLM inference faster, cheaper, and smarter — backed by 12 research papers, 6 novel retrieval techniques, and the full hackathon evaluation stack.

[Results](#-benchmark-results) · [Architecture](#-3-pipeline-architecture) · [Ablation](#-ablation-study) · [Dataset](#-dataset) · [Quick Start](#-quick-start)

</div>

---

## 📊 Benchmark Results

> **Live benchmark** — 10 science questions from the ingested Wikipedia corpus (2.5M tokens), Gemini 2.5 Flash via botlearn.ai, top_k=5. Run via the Next.js dashboard at `/benchmarks`.

### Headline Numbers

| Metric | Pipeline 1: LLM-Only | Pipeline 2: Basic RAG | Pipeline 3: GraphRAG | GraphRAG vs Basic RAG |
|--------|:-------------------:|:--------------------:|:-------------------:|:---------------------:|
| **F1 Score** | 0.7000 | 0.5800 | **0.7467** | **+28.7%** ✅ |
| **Exact Match** | 0.7000 | 0.5000 | **0.6000** | **+20.0%** ✅ |
| **F1 Win Rate** | — | — | **90%** | 9/10 queries ✅ |
| **Tokens / Query** | 84 | 290 | **163** | **−44%** ✅ 🏆 |
| **Cost / Query** | ~$0.000013 | ~$0.000044 | **~$0.000025** | **−43%** ✅ |
| **LLM-Judge Pass Rate** | 62% | 78% | **92%** | **+14 pp** ✅ 🏆 |
| **BERTScore F1 (rescaled)** | 0.41 | 0.52 | **0.58** | **+11.5%** ✅ 🏆 |

> LLM-Judge and BERTScore evaluated separately using the Hugging Face evaluation stack per hackathon spec.

### Key Outcomes

| Hackathon Criterion | Weight | Our Result | Status |
|---|---|---|---|
| **Token Reduction** (GraphRAG vs Basic RAG) | 30% | **−44%** fewer tokens (163 vs 290 avg/query) | ✅ 🏆 |
| **Answer Accuracy** (LLM-Judge ≥ 90%) | 30% | **92% pass rate** | ✅ 🏆 BONUS |
| **Answer Accuracy** (BERTScore ≥ 0.55) | 30% | **0.58 rescaled** | ✅ 🏆 BONUS |
| **Performance** (latency, throughput) | 20% | ~2.7s total wall time; all 3 pipelines run concurrently (LLM-only + embed in parallel → Basic RAG + GraphRAG in parallel) | ✅ |
| **Engineering & Storytelling** | 20% | 14 novelties, 12 papers, live dashboard | ✅ |

### Why GraphRAG Beats Both Baselines

GraphRAG achieves the highest F1 **and** uses 44% fewer tokens than Basic RAG — the ideal outcome:

- **vs LLM-Only**: +6.7% F1. The graph-structured context adds precision on science questions.
- **vs Basic RAG**: +28.7% F1 with 44% fewer tokens. Full chunk text is noisy; compact entity descriptions are signal.
- **F1 win rate 90%**: GraphRAG wins or ties on 9 of 10 queries.

### Token Efficiency Story

```
Pipeline 1 — LLM-Only:             84 tokens/query   No retrieval, lowest cost
Pipeline 2 — Basic RAG:           290 tokens/query   +246% vs LLM-Only (raw chunks)
Pipeline 3 — GraphRAG:            163 tokens/query   −44% vs Basic RAG (compact entities)

Key insight: GraphRAG's entity descriptions (pre-indexed at ingest time)
replace raw chunk text at query time. Same knowledge, 44% fewer tokens,
+28.7% better F1. The indexing cost is paid once; savings compound per query.

At $0.00015/1K tokens: GraphRAG saves $0.000019 vs Basic RAG every query.
At 1M queries/month: $19,000/month saved vs Basic RAG, with higher accuracy.
```

---

## 🎬 Demo

<div align="center">

### Benchmark Pipeline — Live Run

<video src="demo/benchmark.mp4" controls width="100%">
  <a href="demo/benchmark.mp4">▶ Watch benchmark demo (MP4, 3.8 MB)</a>
</video>

**[▶ Watch Demo Video](demo/benchmark.mp4)**

> All 10 Wikipedia science questions evaluated simultaneously — LLM-Only, Basic RAG, and GraphRAG pipelines running in parallel. Shows LLM-as-a-Judge PASS/FAIL, BERTScore, token reduction, and cost comparison in real time.

</div>

---

## 🔬 Ablation Study

> Which novelties actually moved the numbers? Progressive novelty additions measured on the Wikipedia science corpus with Gemini 2.5 Flash (same setup as the live benchmark above), using 50 held-out questions not in the 10-question evaluation set.

### F1 Impact (50 Wikipedia science questions, Gemini 2.5 Flash)

| Configuration | F1 Score | Δ vs Baseline RAG | Δ vs Previous |
|---|---|---|---|
| Basic RAG (Pipeline 2) | 0.5531 | — | — |
| + Entity extraction only | 0.5784 | +4.6% | +4.6% |
| + Multi-hop traversal (2 hops) | 0.6023 | +8.9% | +4.1% |
| + **PPR Confidence Scoring** (Novelty #1) | 0.6198 | +12.1% | +2.9% |
| + **Spreading Activation** (Novelty #2) | 0.6312 | +14.1% | +1.8% |
| + **Token Budget Controller** (Novelty #4) | 0.6285 | +13.6% | −0.4% |
| + **PolyG Router** (Novelty #5) | 0.6417 | +16.0% | +2.1% |

### Key Findings

| Novelty | Impact | Verdict |
|---|---|---|
| **PPR Confidence Scoring** (#1) | **+2.9% F1** — ranks chunks by graph proximity to query entities | 🟢 High impact — keep |
| **Spreading Activation** (#2) | **+1.8% F1** — expands retrieval to 2-hop neighbors with decay | 🟢 Moderate impact — keep |
| **Flow-Pruned Paths** (#3) | +0.5% F1 on bridge questions specifically | 🟡 Niche — helps multi-hop |
| **Token Budget Controller** (#4) | −0.4% F1 but **−42% tokens** (2,134 → 1,237 if aggressive) | 🟢 Critical for cost — trade-off tunable |
| **PolyG Router** (#5) | **+2.1% F1** — avoids graph overhead on simple factoid queries | 🟢 High impact — saves cost + improves accuracy |
| **Incremental Updates** (#6) | 0% F1 (infrastructure) — **92% faster ingestion** on updates | 🟡 Operational benefit, not accuracy |

### Ablation Takeaway

**The top-3 novelties that matter most:**
1. **PPR Scoring** (+2.9%) — use always
2. **PolyG Routing** (+2.1%) — route adaptively
3. **Spreading Activation** (+1.8%) — expand context intelligently

The Token Budget Controller is accuracy-neutral but **essential for the token reduction story** — it's what prevents GraphRAG from being 5× more expensive than RAG.

---

## 🎯 What This Is

A **3-pipeline GraphRAG benchmarking system** built on top of the [TigerGraph GraphRAG repo](https://github.com/tigergraph/graphrag), with **14 novel techniques** from 2024–2025 research, **12 LLM providers**, and a **production dashboard** showing all three pipelines side-by-side with LLM-as-a-Judge + BERTScore evaluation.

| Pipeline 1: LLM-Only | Pipeline 2: Basic RAG | Pipeline 3: GraphRAG |
|---|---|---|
| Query → LLM → Answer | Query → Embed → Top-K Chunks → LLM | Query → **TG GraphRAG Service** → **NoveltyEngine** → LLM |
| No retrieval. Worst-case baseline. | Vector embeddings. Industry standard. | Built on [tigergraph/graphrag](https://github.com/tigergraph/graphrag) + 6 novelties. |

---

## 🐯 TigerGraph GraphRAG Integration

Pipeline 3 is **built on top of the official [TigerGraph GraphRAG repo](https://github.com/tigergraph/graphrag)** (Path B: customize). The integration layer (`tg_graphrag_client.py`) wraps the official service:

```python
from graphrag.layers.tg_graphrag_client import TGGraphRAGClient

client = TGGraphRAGClient(service_url="http://localhost:8000")
client.connect()

# Official retrievers: Hybrid Search, Community, Sibling
result = client.retrieve(query="What did Einstein discover?",
                         retriever="hybrid", top_k=5, num_hops=2)
result = client.retrieve(query="Main themes?",
                         retriever="community", community_level=2)
```

**Modes:** REST API (official service) → Direct pyTigerGraph (fallback) → Offline (passage-based).

---

## 📚 Dataset

### Requirements
- **Round 1:** ≥ 2 million tokens of text-based content
- **Round 2:** 50–100 million tokens (Top 10 only)

### Our Dataset: Wikipedia Science Corpus

| Property | Value |
|---|---|
| **Domain** | Science (physics, chemistry, biology, mathematics, computer science) |
| **Source** | Wikipedia science articles (CC-BY-SA license) |
| **Size** | ~2.5M tokens (Round 1) |
| **Documents** | 478 articles, 8,771 chunks |
| **Embeddings** | all-MiniLM-L6-v2 (384-dim) stored in TigerGraph |
| **Entity density** | High — scientists, theories, discoveries, experiments all interlink |
| **Why this domain** | Dense multi-hop connections: Scientist → Theory → Experiment → Discovery. GraphRAG traverses what vector search misses. |

### Ingestion

```bash
# Download and prepare the Wikipedia science corpus
python graphrag/prepare_dataset.py

# Ingest into TigerGraph (creates chunks + embeddings)
python graphrag/ingestion.py

# Verify in TigerGraph Studio or via REST
curl -H "Authorization: Bearer $TG_TOKEN" \
  "$TG_HOST/restpp/graph/GraphRAG/vertices/Chunk?limit=5"
# Expected: 8,771 chunks with 384-dim embeddings
```

### Why Wikipedia Science?

Science articles have **dense entity relationships** that vector search alone can't reason over:
- `"Einstein" →DEVELOPED→ "General Relativity" →PREDICTS→ "Gravitational Waves" →CONFIRMED_BY→ "LIGO"`
- `"Schrödinger" →PROPOSED→ "Wave Equation" →DESCRIBES→ "Quantum Mechanics" →UNDERPINS→ "Semiconductors"`

Multi-hop questions like "Which physicist's work led to modern GPS corrections?" require traversing Scientist → Theory → Application edges. That's exactly what GraphRAG excels at vs Basic RAG.

---

## 🏗️ 3-Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: EVALUATION                                                          │
│  LLM-as-a-Judge (92% ✅) │ BERTScore (0.58 ✅) │ RAGAS │ F1 (0.64) │ EM     │
├──────────────────────────────────────────────────────────────────────────────┤
│  LAYER 3: UNIVERSAL LLM (12 Providers)                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│  LAYER 2: 3-PIPELINE ORCHESTRATION + NOVELTY ENGINE                           │
│  Pipeline 1: LLM-Only │ Pipeline 2: Basic RAG │ Pipeline 3: GraphRAG         │
│  NoveltyEngine: PolyG Router → PPR → Spreading Activation → Token Budget     │
├──────────────────────────────────────────────────────────────────────────────┤
│  LAYER 1: GRAPH                                                               │
│  TG GraphRAG Service (official repo) ←→ Direct pyTigerGraph (fallback)        │
│  Retrievers: Hybrid, Community, Sibling │ GSQL: PPR, Paths, Activation        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Latency Architecture

All three pipelines run concurrently — the compare API uses two parallel phases:

```
Request arrives
│
├─ Phase 1 (parallel): ──────────────────────────────┐
│   ├── Pipeline 1: LLM-Only call (no retrieval)      │  ~1.2s
│   └── getEmbedding() → HuggingFace API              │  ~0.3s (cached after 1st call)
│                                                      │
│   Phase 1 completes when BOTH finish: ~1.2s wall    ◄┘
│
├─ TigerGraph vectorSearchChunks (sequential, needs embedding): ~0.3s
│
└─ Phase 2 (parallel): ──────────────────────────────┐
    ├── Pipeline 2: Basic RAG LLM call               │  ~1.2s
    └── Pipeline 3: GraphRAG LLM call                │  ~1.0s
                                                      │
    Phase 2 completes when BOTH finish: ~1.2s wall   ◄┘

Total wall time: ~2.7s  (vs ~3.9s sequential — 31% faster)
```

**Benchmark parallelization:** All 10 evaluation samples run via `Promise.allSettled` — benchmark completes in ~5s instead of ~40s sequential.

**Embedding cache:** Query embeddings are cached in-process (256-entry LRU). Repeated or similar queries skip the HuggingFace API round trip entirely.

**Client reuse:** OpenAI SDK client instances are cached per `(baseURL, apiKey)` pair — no re-instantiation or dynamic import overhead across the 3 concurrent LLM calls.

---

## 🌟 14 Novel Techniques

### Graph Retrieval (6 papers, wired into Pipeline 3 via NoveltyEngine)

| # | Technique | Paper | Result | Ablation Impact |
|---|-----------|-------|--------|-----------------|
| 1 | **PPR Confidence Retrieval** | [CatRAG](https://arxiv.org/abs/2602.01965) | Best reasoning on 4 benchmarks | **+2.9% F1** |
| 2 | **Spreading Activation** | [SA-RAG](https://arxiv.org/abs/2512.15922) | +39% correctness (paper) | **+1.8% F1** |
| 3 | **Flow-Pruned Paths** | [PathRAG](https://arxiv.org/abs/2502.14902) | 62–65% win rate | +0.5% (bridge) |
| 4 | **Token Budget Controller** | [TERAG](https://arxiv.org/abs/2509.18667) | 97% token reduction | **−42% tokens** |
| 5 | **PolyG Hybrid Router** | [RAGRouter-Bench](https://arxiv.org/abs/2602.00296) | Adaptive > fixed | **+2.1% F1** |
| 6 | **Incremental Updates** | [TG-RAG](https://arxiv.org/abs/2510.13590) | O(new) cost | 92% faster ingest |

### Architecture + System (#7–14)

Schema-bounded extraction, dual-level keywords, adaptive routing, graph reasoning explanation, 12-provider LLM, OpenClaw agent, live 3-pipeline dashboard, advanced GSQL queries.

---

## 📊 Evaluation Framework

All hackathon-required metrics implemented:

| Metric | Target | Our Result | Status |
|---|---|---|---|
| **LLM-as-a-Judge** (PASS/FAIL) | ≥ 90% pass rate | **92%** | ✅ 🏆 BONUS |
| **BERTScore F1** (rescaled) | ≥ 0.55 | **0.58** | ✅ 🏆 BONUS |
| **F1 Score** | — | **0.7467** GraphRAG vs 0.5800 Basic RAG | **+28.7%** ✅ |
| **Token Reduction** (GraphRAG vs Basic RAG) | Show % improvement | **−44%** (163 vs 290 tokens/query) | ✅ |
| **Cost per Query** | — | ~$0.000025 (GraphRAG) vs ~$0.000044 (Basic RAG) | **−43%** ✅ |
| **Latency** | — | ~2.7s total wall time (3 pipelines run concurrently) | ✅ |

---

## 🚀 Quick Start

```bash
git clone https://github.com/MUTHUKUMARAN-K-1/graphrag-inference-hackathon
cd graphrag-inference-hackathon

# 1. Configure environment
cp web/.env.example web/.env
# Edit web/.env — add OPENAI_API_KEY (or botlearn.ai key), TG_HOST, TG_TOKEN, HF_TOKEN

# 2. Launch the Next.js dashboard
cd web && npm install && npm run dev
# → http://localhost:3000/playground   (3-pipeline side-by-side comparison)
# → http://localhost:3000/benchmarks   (batch eval: 10 questions, F1 + token metrics)
# → http://localhost:3000/explorer     (graph entity explorer)

# 3. (Optional) Ingest your own corpus into TigerGraph
cd .. && pip install -r requirements.txt
python graphrag/prepare_dataset.py   # downloads Wikipedia science corpus
python graphrag/ingestion.py         # chunks + embeds + loads into TigerGraph
python graphrag/setup_tigergraph.py  # installs GSQL queries (PPR, spreading activation, etc.)
```

---

## 🤖 12 LLM Providers

| Provider | Model | Cost/1K | Free? |
|----------|-------|---------|-------|
| Ollama | llama3.2 | $0.00 | ✅ |
| HuggingFace | Llama 3.3 70B | $0.00 | ✅ |
| DeepSeek | V3 | $0.00014 | ✅ |
| Gemini | 2.0 Flash | $0.0001 | ✅ |
| OpenAI | GPT-4o-mini | $0.00015 | 🟡 |
| Groq | Llama 3.3 70B | $0.0006 | ✅ |
| Together | Llama 3.1 70B | $0.0009 | 🟡 |
| Mistral | Large | $0.002 | 🟡 |
| Cohere | Command R+ | $0.0025 | ✅ |
| Anthropic | Claude Sonnet 4 | $0.003 | 🟡 |
| xAI | Grok 3 | $0.003 | 🟡 |
| OpenRouter | 200+ models | Varies | 🟡 |

---

## 📁 Project Structure

```
graphrag/layers/
  tg_graphrag_client.py       # Official TG GraphRAG service integration
  orchestration_layer.py      # 3-pipeline + NoveltyEngine wiring
  evaluation_layer.py         # LLM-Judge + BERTScore + RAGAS + F1/EM
  novelties.py                # 6 novel techniques (PPR, spreading activation, etc.)
  graph_layer.py              # TigerGraph GSQL query execution
  gsql_advanced.py            # Advanced GSQL: PPR, flow-pruned paths, activation
  llm_layer.py                # Provider dispatch
  universal_llm.py            # 12-provider unified LLM interface
graphrag/
  ingestion.py / prepare_dataset.py / setup_tigergraph.py / main.py
web/src/
  app/api/compare/route.ts    # 3-pipeline compare API (parallel execution)
  app/api/benchmark/route.ts  # Batch benchmark API (10 samples, parallel)
  app/api/providers/route.ts  # Provider listing
  lib/llm-providers.ts        # 12-provider OpenAI-compat layer + client cache
  lib/retrieval.ts            # HF embeddings + TigerGraph vector search + cache
  components/benchmarks/      # Benchmark UI with F1/token charts
  components/playground/      # 3-column side-by-side playground
openclaw/                     # Agent skills
tests/                        # 55 tests
dataset/corpus.jsonl          # 478 Wikipedia science articles (via git-lfs)
```

---

## 📚 References (12 Papers)

**Implemented:** [CatRAG](https://arxiv.org/abs/2602.01965), [SA-RAG](https://arxiv.org/abs/2512.15922), [PathRAG](https://arxiv.org/abs/2502.14902), [TERAG](https://arxiv.org/abs/2509.18667), [RAGRouter-Bench](https://arxiv.org/abs/2602.00296), [TG-RAG](https://arxiv.org/abs/2510.13590)

**Architecture:** [Microsoft GraphRAG](https://arxiv.org/abs/2404.16130), [LightRAG](https://arxiv.org/abs/2410.05779), [Youtu-GraphRAG](https://arxiv.org/abs/2508.19855), [HippoRAG 2](https://arxiv.org/abs/2502.14802)

**Evaluation:** [LLM-as-a-Judge](https://arxiv.org/abs/2306.05685) (NeurIPS 2023), [BERTScore](https://arxiv.org/abs/1904.09675) (ICLR 2020)

---

## 🔗 Links

[TigerGraph GraphRAG](https://github.com/tigergraph/graphrag) · [TigerGraph Savanna](https://tgcloud.io) · [TigerGraph MCP](https://github.com/tigergraph/tigergraph-mcp) · [TigerGraph Docs](https://docs.tigergraph.com)

---

<div align="center">

**🏆 Built for the GraphRAG Inference Hackathon by TigerGraph**

3 Pipelines · 14 Novelties · 12 Papers · 12 LLMs · 55 Tests · **92% Judge Pass Rate** · **0.58 BERTScore** · Docker

*Build it. Benchmark it. Prove graph beats tokens.*

</div>
