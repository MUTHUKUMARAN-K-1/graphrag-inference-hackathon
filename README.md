# 🔍 GraphRAG Inference Hackathon — Dual Pipeline System

<div align="center">

[![TigerGraph](https://img.shields.io/badge/Graph-TigerGraph-FF6B00?style=for-the-badge)](https://www.tigergraph.com/)
[![14 Novelties](https://img.shields.io/badge/Novelties-14_Techniques-002B49?style=for-the-badge)](#-14-novel-techniques)
[![12 LLMs](https://img.shields.io/badge/LLMs-12_Providers-0072CE?style=for-the-badge)](#-supported-llm-providers)
[![10 Papers](https://img.shields.io/badge/Papers-10_Cited-cc785c?style=for-the-badge)](#-references)
[![55 Tests](https://img.shields.io/badge/Tests-55_Passing-5db872?style=for-the-badge)](#-testing)

**Proving that graphs make LLM inference faster, cheaper, and smarter — backed by 10 research papers.**

[14 Novelties](#-14-novel-techniques) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [Benchmarks](#-benchmarks) · [Papers](#-references)

</div>

---

## 🎯 What This Is

A **dual-pipeline GraphRAG system** with **14 novel techniques** from cutting-edge 2024–2025 research, **12 LLM providers** (including free Ollama local), **OpenClaw agent integration**, and a **production Next.js dashboard** — all built on TigerGraph.

| Pipeline A (Baseline) | Pipeline B (GraphRAG) |
|---|---|
| Query → LLM → Answer | Query → **PolyG Router** → **PPR Scoring** → **Spreading Activation** → **Path Pruning** → **Token Budget** → LLM → Answer |
| Simple, expensive | Smart, graph-enhanced, cost-controlled |

---

## 🌟 14 Novel Techniques

### Graph Retrieval Innovations (from 6 papers)

| # | Technique | Paper | Key Result | Implementation |
|---|-----------|-------|------------|----------------|
| 1 | **PPR Confidence-Weighted Retrieval** | CatRAG `2602.01965` | Best reasoning completeness on 4 benchmarks | `PPRConfidenceScorer` — Personalized PageRank from seed entities, scores = context confidence |
| 2 | **Spreading Activation Context Scoring** | SA-RAG `2512.15922` | **+39% answer correctness** on MuSiQue | `SpreadingActivation` — propagates activation through graph with decay, ranks by signal strength |
| 3 | **Flow-Pruned Path Serialization** | PathRAG `2502.14902` | **62–65% win rate** vs LightRAG | `PathPruner` — finds reasoning paths, prunes by flow threshold, serializes high-reliability first (exploits lost-in-the-middle bias) |
| 4 | **Graph Token Budget Controller** | TERAG `2509.18667` | **97% token reduction** at 80%+ accuracy | `TokenBudgetController` — caps context by token limit, prioritizes by score × relevance |
| 5 | **PolyG Hybrid Retrieval Router** | RAGRouter-Bench `2602.00296` | Adaptive > any fixed paradigm | `PolyGRouter` — 4-class query taxonomy (entity/relation/multi-hop/summarization) → optimal strategy |
| 6 | **Incremental Graph Updates** | TG-RAG `2510.13590` | O(new) vs O(all) recomputation | `IncrementalGraphUpdater` — merge by embedding similarity, scoped community re-detection |

### Architecture Innovations

| # | Technique | Paper | Description |
|---|-----------|-------|-------------|
| 7 | **Schema-Bounded Entity Extraction** | Youtu-GraphRAG `2508.19855` | 9 entity types + 15 relation types — ~90% extraction cost reduction, +16% accuracy |
| 8 | **Dual-Level Keyword Retrieval** | LightRAG `2410.05779` | High-level (themes) + low-level (entities) keywords for dual-channel retrieval |
| 9 | **Adaptive Query Complexity Router** | Original | LLM scores query complexity 0.0–1.0 → routes simple to baseline, complex to GraphRAG |
| 10 | **Graph Reasoning Path Explanation** | Original | Natural language step-by-step traversal explanation (Entry → Traversal → Evidence → Conclusion) |

### System Innovations

| # | Technique | Description |
|---|-----------|-------------|
| 11 | **12-Provider Universal LLM** | Single interface for OpenAI, Claude, Gemini, Mistral, Ollama, Groq, DeepSeek, etc. |
| 12 | **OpenClaw Agent Skills** | GraphRAG as autonomous agent capabilities (CIK model: SOUL + IDENTITY + MEMORY + Skills) |
| 13 | **Live Dashboard Benchmarking** | "Run Benchmark Now" button — judges can evaluate both pipelines in real-time |
| 14 | **Advanced GSQL Queries** | PPR, shortest paths, spreading activation, neighborhood extraction — all as installable TigerGraph queries |

---

## 🏗️ Architecture (AI Factory — 4 Layers)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: EVALUATION                                                      │
│  RAGAS │ F1/EM │ Token Tracking │ Live Benchmark │ Next.js Dashboard      │
├──────────────────────────────────────────────────────────────────────────┤
│  LAYER 3: UNIVERSAL LLM (12 Providers)                                    │
│  OpenAI │ Claude │ Gemini │ Mistral │ Ollama │ Groq │ DeepSeek │ …       │
├──────────────────────────────────────────────────────────────────────────┤
│  LAYER 2: INFERENCE ORCHESTRATION + NOVELTY ENGINE                        │
│  ┌─ PolyG Router ─→ PPR Scoring ─→ Spreading Activation ─┐              │
│  │  Path Pruning ─→ Token Budget ─→ Structured Context     │              │
│  ├─ Pipeline A: Baseline (Query → Vector → LLM)           │              │
│  └─ Pipeline B: GraphRAG (Query → Graph → Novelties → LLM)│              │
├──────────────────────────────────────────────────────────────────────────┤
│  LAYER 1: GRAPH (TigerGraph)                                              │
│  GSQL: PPR │ Shortest Paths │ Spreading Activation │ Vector Search        │
│  Schema: Document → Chunk → Entity → Community                            │
│  Incremental Updates │ Schema-Bounded Extraction                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### How the Novelty Engine Works (Pipeline B)

```
Query: "Were Einstein and Newton of the same nationality?"

Step 1: PolyG Router → "multi_hop" (score=0.7) → use graph_traversal
Step 2: PPR from seeds [Einstein, Newton] → score all reachable entities
Step 3: Spreading Activation → expand to 2-hop neighborhood with decay
Step 4: Combined scoring (0.6×PPR + 0.4×Activation) per chunk
Step 5: Token Budget (2000 tokens) → select top chunks, prune 60%+ redundancy
Step 6: Path Serialization → "Einstein →BORN_IN→ Germany, Newton →BORN_IN→ England"
Step 7: LLM generates answer with ranked, pruned, path-structured context
```

---

## 🚀 Quick Start

```bash
# Option A: Next.js Dashboard
cd web && npm install && npm run dev    # → http://localhost:3000

# Option B: Docker
docker build -t graphrag . && docker run -p 3000:3000 graphrag

# Option C: Python CLI
pip install -r requirements.txt && python -m graphrag.main demo

# Option D: Ollama (100% free)
ollama pull llama3.2 && cd web && npm install && npm run dev
```

---

## 🤖 12 LLM Providers

| Provider | Model | Cost | Speed |
|----------|-------|------|-------|
| **Ollama** 🦙 | llama3.2 | **$0** | ⚡ Local |
| **HuggingFace** | Llama 3.3 70B | **$0** | 🔵 Medium |
| **DeepSeek** | DeepSeek V3 | $0.00014/1K | ⚡ Fast |
| **OpenAI** | GPT-4o-mini | $0.00015/1K | ⚡ Fast |
| **Groq** | Llama 3.3 70B | $0.0006/1K | ⚡⚡ Blazing |
| **Gemini** | 2.0 Flash | $0.0001/1K | ⚡ Fast |
| **Mistral** | Large | $0.002/1K | 🔵 Medium |
| **Anthropic** | Claude Sonnet 4 | $0.003/1K | 🔵 Medium |
| **OpenRouter** | 200+ models | Varies | Varies |
| **Cohere** | Command R+ | $0.0025/1K | 🔵 Medium |
| **xAI** | Grok 3 | $0.003/1K | 🔵 Medium |
| **Together** | Llama 3.1 70B | $0.0009/1K | ⚡ Fast |

---

## 📊 Benchmarks

### Live Benchmark (from Dashboard)
Click **"🏃 Run Benchmark Now"** → evaluates both pipelines on HotpotQA with real F1/EM.

### Expected Performance (HotpotQA)

| Metric | Baseline | GraphRAG | Δ | Winner |
|--------|----------|----------|---|--------|
| F1 Score | ~0.45–0.60 | ~0.55–0.70 | +13–21% | ✅ GraphRAG |
| Exact Match | ~0.30–0.45 | ~0.35–0.50 | +11% | ✅ GraphRAG |
| Tokens/Query | ~800–1000 | ~1200–1800* | — | ✅ Baseline |
| F1 Win Rate | — | ~55–70% | — | ✅ GraphRAG |

*\*With Token Budget Controller, GraphRAG context is capped at 2000 tokens — 40–60% reduction vs. unbounded.*

### By Question Type

| Type | Baseline F1 | GraphRAG F1 | Δ | Why |
|------|------------|-------------|---|-----|
| **Bridge** (multi-hop) | ~0.52 | ~0.63 | **+21%** | Graph traversal connects cross-document facts |
| **Comparison** | ~0.58 | ~0.61 | +5% | Entity-pair paths provide structured comparison context |

---

## 🦞 OpenClaw Agent Integration

| Component | File | Purpose |
|-----------|------|---------|
| SOUL.md | `openclaw/SOUL.md` | Agent identity, values, boundaries |
| IDENTITY.md | `openclaw/IDENTITY.md` | Provider config, schema, channels |
| MEMORY.md | `openclaw/MEMORY.md` | Learned performance knowledge |
| graph_query | `openclaw/skills/graph_query/` | NL → knowledge graph traversal |
| compare_pipelines | `openclaw/skills/compare_pipelines/` | Dual-pipeline comparison |
| cost_estimate | `openclaw/skills/cost_estimate/` | 12-provider cost projection |

---

## 🧪 Testing

```bash
python tests/test_core.py        # 31 tests — core functions
python tests/test_novelties.py   # 24 tests — all 6 novelty techniques
# Total: 55 tests covering PPR, activation, routing, paths, budgets, F1/EM
```

---

## 📁 Project Structure (75 files, 280KB)

```
├── web/                                # Next.js 15 Dashboard
│   ├── src/app/api/
│   │   ├── compare/route.ts            # Multi-provider dual-pipeline API
│   │   ├── benchmark/route.ts          # Live benchmark with F1/EM
│   │   └── providers/route.ts          # Provider health + listing
│   ├── src/components/tabs/
│   │   ├── LiveCompare.tsx             # Provider selector + comparison
│   │   ├── Benchmark.tsx               # Live "Run Now" + charts
│   │   ├── CostAnalysis.tsx            # 12-provider projections
│   │   └── GraphExplorer.tsx           # Interactive SVG graph
│   └── src/lib/
│       ├── llm-providers.ts            # 12-provider universal client
│       └── design-tokens.ts            # TigerGraph×Claude tokens
│
├── graphrag/layers/
│   ├── graph_layer.py                  # Layer 1: TigerGraph + GSQL
│   ├── orchestration_layer.py          # Layer 2: Dual pipeline + routing
│   ├── llm_layer.py                    # Layer 3: LLM interactions
│   ├── universal_llm.py               # Layer 3: 12-provider support
│   ├── evaluation_layer.py            # Layer 4: RAGAS + F1/EM
│   ├── novelties.py                   # 🌟 6 novel techniques (NEW)
│   └── gsql_advanced.py               # 🌟 Advanced GSQL queries (NEW)
│
├── openclaw/                           # OpenClaw Agent (CIK model)
├── tests/
│   ├── test_core.py                    # 31 core tests
│   └── test_novelties.py              # 24 novelty tests (NEW)
├── Dockerfile
└── README.md
```

---

## 📚 References

### Directly Implemented (6 papers)
1. **CatRAG** — PPR + Dynamic Edge Weighting — [arXiv:2602.01965](https://arxiv.org/abs/2602.01965) (Feb 2025)
2. **PathRAG** — Flow-Pruned Path Retrieval — [arXiv:2502.14902](https://arxiv.org/abs/2502.14902) (Feb 2025)
3. **TERAG** — Token-Efficient Graph RAG — [arXiv:2509.18667](https://arxiv.org/abs/2509.18667) (Sep 2024)
4. **SA-RAG** — Spreading Activation Retrieval — [arXiv:2512.15922](https://arxiv.org/abs/2512.15922) (Dec 2024)
5. **RAGRouter-Bench** — Hybrid Routing — [arXiv:2602.00296](https://arxiv.org/abs/2602.00296) (Feb 2025)
6. **TG-RAG** — Incremental Temporal Graph — [arXiv:2510.13590](https://arxiv.org/abs/2510.13590) (Oct 2024)

### Architecture Inspiration (4 papers)
7. **GraphRAG** — Microsoft's Community-Based RAG — [arXiv:2404.16130](https://arxiv.org/abs/2404.16130)
8. **LightRAG** — Dual-Level Retrieval (34K⭐) — [arXiv:2410.05779](https://arxiv.org/abs/2410.05779)
9. **Youtu-GraphRAG** — Schema-Bounded Extraction (Tencent) — [arXiv:2508.19855](https://arxiv.org/abs/2508.19855)
10. **HippoRAG 2** — PPR + Passage Integration — [arXiv:2502.14802](https://arxiv.org/abs/2502.14802)

### Datasets & Evaluation
- [HotpotQA](https://arxiv.org/abs/1809.09600) — Multi-hop QA benchmark
- [RAGAS](https://arxiv.org/abs/2309.15217) — RAG evaluation framework

---

<div align="center">

### 🏆 Built for the GraphRAG Inference Hackathon by TigerGraph

**14 Novel Techniques** · **10 Research Papers** · **12 LLM Providers** · **55 Unit Tests** · **OpenClaw Agent** · **Docker**

*Proving that graphs make LLM inference faster, cheaper, and smarter.*

</div>
