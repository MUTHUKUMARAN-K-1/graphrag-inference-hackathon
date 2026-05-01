# 🔍 GraphRAG Inference Hackathon — 3-Pipeline Benchmarking System

<div align="center">

[![TigerGraph](https://img.shields.io/badge/Built_On-TigerGraph_GraphRAG-FF6B00?style=for-the-badge)](https://github.com/tigergraph/graphrag)
[![3 Pipelines](https://img.shields.io/badge/Pipelines-3_(LLM+RAG+GraphRAG)-002B49?style=for-the-badge)](#-3-pipeline-architecture)
[![14 Novelties](https://img.shields.io/badge/Novelties-14_Techniques-0072CE?style=for-the-badge)](#-14-novel-techniques)
[![12 LLMs](https://img.shields.io/badge/LLMs-12_Providers-5865F2?style=for-the-badge)](#-12-llm-providers)
[![12 Papers](https://img.shields.io/badge/Papers-12_Cited-cc785c?style=for-the-badge)](#-references)
[![55 Tests](https://img.shields.io/badge/Tests-55_Passing-5db872?style=for-the-badge)](#-testing)

**One query in → three pipelines run → side-by-side responses + metrics out.**

Proving that graphs make LLM inference faster, cheaper, and smarter — backed by 12 research papers, 6 novel retrieval techniques, and the full hackathon evaluation stack.

[3-Pipeline Architecture](#-3-pipeline-architecture) · [TG GraphRAG Integration](#-tigergraph-graphrag-integration) · [Novelties](#-14-novel-techniques) · [Evaluation](#-evaluation-framework) · [Quick Start](#-quick-start)

</div>

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

```bash
# Deploy official TG GraphRAG + point our system at it
git clone https://github.com/tigergraph/graphrag && cd graphrag && docker-compose up -d
export GRAPHRAG_SERVICE_URL=http://localhost:8000
python -m graphrag.main benchmark --samples 50
```

---

## 🏗️ 3-Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: EVALUATION                                                          │
│  LLM-as-a-Judge (PASS/FAIL, ≥90%) │ BERTScore F1 (≥0.55) │ RAGAS │ F1/EM    │
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

### Pipeline 3 Flow

```
Query → keyword extraction → TG GraphRAG Service (hybrid retriever)
      → NoveltyEngine: PolyG Router → PPR → Spreading Activation → Token Budget
      → Structured context (entities + relationships + passages) → LLM → Answer
```

---

## 🌟 14 Novel Techniques

### Graph Retrieval (6 papers, wired into Pipeline 3 via NoveltyEngine)

| # | Technique | Paper | Result | Code |
|---|-----------|-------|--------|------|
| 1 | PPR Confidence Retrieval | [CatRAG](https://arxiv.org/abs/2602.01965) | Best reasoning on 4 benchmarks | `PPRConfidenceScorer` |
| 2 | Spreading Activation | [SA-RAG](https://arxiv.org/abs/2512.15922) | +39% correctness | `SpreadingActivation` |
| 3 | Flow-Pruned Paths | [PathRAG](https://arxiv.org/abs/2502.14902) | 62–65% win rate | `PathPruner` |
| 4 | Token Budget Controller | [TERAG](https://arxiv.org/abs/2509.18667) | 97% token reduction | `TokenBudgetController` |
| 5 | PolyG Hybrid Router | [RAGRouter-Bench](https://arxiv.org/abs/2602.00296) | Adaptive > fixed | `PolyGRouter` |
| 6 | Incremental Updates | [TG-RAG](https://arxiv.org/abs/2510.13590) | O(new) cost | `IncrementalGraphUpdater` |

### Architecture + System (#7–14)

Schema-bounded extraction, dual-level keywords, adaptive routing, graph reasoning explanation, 12-provider LLM, OpenClaw agent, live 3-pipeline dashboard, advanced GSQL queries.

---

## 📊 Evaluation Framework

All hackathon-required metrics implemented in `evaluation_layer.py`:

| Metric | Target | Implementation |
|---|---|---|
| **LLM-as-a-Judge** (PASS/FAIL) | ≥ 90% pass rate | `compute_llm_judge()` — reference-guided, CoT, JSON output |
| **BERTScore F1** | ≥ 0.55 rescaled / ≥ 0.88 raw | `compute_bertscore()` — roberta-large with rescaling |
| **F1 / Exact Match** | — | SQuAD/HotpotQA standard |
| **RAGAS** | — | Faithfulness, Relevancy, Context Precision/Recall |
| **Token Efficiency** | — | Per-pipeline per-query tracking |
| **Cost per Query** | — | `tokens × provider_pricing` |
| **Latency** | — | End-to-end ms |

```python
from graphrag.layers.evaluation_layer import compute_llm_judge, compute_bertscore

# LLM-as-a-Judge
result = compute_llm_judge(question, reference, candidate, llm_fn)
# → {"verdict": "PASS", "feedback": "..."}

# BERTScore
results = compute_bertscore(predictions, references, rescale=True)
# → {"mean_f1": 0.62, "pass_rate": 0.85}
```

---

## 🚀 Quick Start

```bash
git clone https://huggingface.co/muthuk1/graphrag-inference-hackathon
cd graphrag-inference-hackathon && cp .env.example .env
pip install -r requirements.txt

# Setup TigerGraph (schema + core + advanced GSQL queries)
python graphrag/setup_tigergraph.py

# 3-pipeline benchmark
python -m graphrag.main benchmark --samples 50 --output results.json

# 3-column Gradio dashboard
python -m graphrag.main dashboard

# Next.js dashboard
cd web && npm install && npm run dev

# Docker
docker build -t graphrag . && docker run -p 3000:3000 -p 7860:7860 --env-file .env graphrag

# Free (Ollama)
ollama pull llama3.2 && python -m graphrag.main demo
```

---

## 📁 Project Structure

```
graphrag/layers/
  tg_graphrag_client.py       # 🆕 Official TG GraphRAG service integration
  orchestration_layer.py      # 🆕 3-pipeline + NoveltyEngine wiring
  evaluation_layer.py         # 🆕 LLM-Judge + BERTScore + RAGAS + F1/EM
  novelties.py                # 6 novel techniques (PPR, activation, paths, budget, router, incremental)
  graph_layer.py              # TigerGraph GSQL + schema
  gsql_advanced.py            # Advanced GSQL (PPR, paths, activation)
  llm_layer.py / universal_llm.py  # 12-provider LLM
graphrag/
  benchmark.py                # 🆕 3-pipeline HotpotQA benchmark
  dashboard.py                # 🆕 3-column Gradio dashboard
  setup_tigergraph.py         # 🆕 Schema + core + advanced query install
  ingestion.py / main.py
web/src/app/api/compare/      # 🆕 3-pipeline Next.js API
openclaw/                     # Agent skills
tests/                        # 55 tests
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

3 Pipelines · 14 Novelties · 12 Papers · 12 LLMs · 55 Tests · LLM-Judge + BERTScore · Docker

*Build it. Benchmark it. Prove graph beats tokens.*

</div>
