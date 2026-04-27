# 🔍 GraphRAG Inference Hackathon — Dual Pipeline System

<div align="center">

[![TigerGraph](https://img.shields.io/badge/Graph-TigerGraph-FF6B00?style=for-the-badge)](https://www.tigergraph.com/)
[![12 LLMs](https://img.shields.io/badge/LLMs-12_Providers-002B49?style=for-the-badge)](#-supported-llm-providers)
[![OpenClaw](https://img.shields.io/badge/Agent-OpenClaw-cc785c?style=for-the-badge)](#-openclaw-integration)
[![Ollama](https://img.shields.io/badge/Local-Ollama-5db872?style=for-the-badge)](#-ollama-local-models)
[![Next.js](https://img.shields.io/badge/UI-Next.js_15-000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Tests](https://img.shields.io/badge/Tests-31_passing-5db872?style=for-the-badge)](#-testing)

**Proving that graphs make LLM inference faster, cheaper, and smarter — with any LLM provider.**

[Quick Start](#-quick-start) · [12 Providers](#-supported-llm-providers) · [OpenClaw](#-openclaw-integration) · [Architecture](#-architecture) · [Benchmarks](#-benchmarks) · [Deploy](#-deployment)

</div>

---

## 🚀 Quick Start

### Option A: Next.js Dashboard (Recommended)
```bash
cd web
npm install
cp .env.example .env.local
# Set ANY provider key — or just use Ollama for free:
npm run dev
# → http://localhost:3000
```

### Option B: Docker (One Command)
```bash
docker build -t graphrag .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... graphrag
```

### Option C: Python CLI
```bash
pip install -r requirements.txt
python -m graphrag.main demo
```

### Option D: Ollama (100% Free, Local)
```bash
ollama pull llama3.2
cd web && npm install && npm run dev
# Select "Ollama (Local)" in provider dropdown
```

---

## 🏗️ Architecture (AI Factory Model — 4 Layers)

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 4: EVALUATION                                                  │
│  Next.js Dashboard │ RAGAS │ F1/EM │ Cost Tracking │ Live Benchmark  │
├──────────────────────────────────────────────────────────────────────┤
│  LAYER 3: UNIVERSAL LLM (12 Providers)                                │
│  OpenAI │ Claude │ Gemini │ Mistral │ Ollama │ Groq │ DeepSeek │ …  │
├────────────────────────────┬─────────────────────────────────────────┤
│  Pipeline A: Baseline RAG  │  Pipeline B: GraphRAG                   │
│  Query → Vector → LLM      │  Query → Keywords → Graph → Context → LLM │
│                            │  🧠 Adaptive Router │ 🔗 Reasoning Paths │
├────────────────────────────┴─────────────────────────────────────────┤
│  LAYER 1: GRAPH (TigerGraph Cloud)                                    │
│  Schema: Document → Chunk → Entity → Community                       │
│  GSQL: vectorSearchChunks │ vectorSearchEntities │ graphRAGTraverse   │
└──────────────────────────────────────────────────────────────────────┘
```

**Each layer is a separate module** — swap TigerGraph for Neo4j, Claude for Ollama, or RAGAS for custom evals without touching other layers.

---

## 🤖 Supported LLM Providers

| # | Provider | Default Model | Cost/1K tokens | Speed |
|---|----------|---------------|----------------|-------|
| 1 | **OpenAI** | gpt-4o-mini | $0.00015 in / $0.0006 out | ⚡ Fast |
| 2 | **Anthropic Claude** | claude-sonnet-4 | $0.003 / $0.015 | 🔵 Medium |
| 3 | **Google Gemini** | gemini-2.0-flash | $0.0001 / $0.0004 | ⚡ Fast |
| 4 | **Mistral AI** | mistral-large | $0.002 / $0.006 | 🔵 Medium |
| 5 | **Cohere** | command-r-plus | $0.0025 / $0.01 | 🔵 Medium |
| 6 | **🦙 Ollama** | llama3.2 | **$0 / $0** | ⚡ Local |
| 7 | **OpenRouter** | llama-3.3-70b | $0.0004 / $0.0004 | 🔵 Medium |
| 8 | **Groq** | llama-3.3-70b | $0.0006 / $0.0008 | ⚡⚡ Blazing |
| 9 | **xAI Grok** | grok-3-mini | $0.0003 / $0.0005 | ⚡ Fast |
| 10 | **Together AI** | llama-3.1-70b | $0.0009 / $0.0009 | ⚡ Fast |
| 11 | **HuggingFace** | llama-3.3-70b | **$0 / $0** | 🔵 Medium |
| 12 | **DeepSeek** | deepseek-chat | $0.00014 / $0.00028 | ⚡ Fast |

**How:** All providers use OpenAI SDK with dynamic `baseURL` — zero extra dependencies. Switch providers from the **dropdown in the dashboard UI**.

---

## 🌟 Novel Features

1. **🧠 Adaptive Query Router** — complexity scoring → auto pipeline selection
2. **📋 Schema-Bounded Extraction** — 9 entity types + 15 relation types
3. **🔑 Dual-Level Keywords** — LightRAG-inspired high/low-level retrieval
4. **🔗 Graph Reasoning Paths** — step-by-step NL traversal explanation
5. **🤖 12-Provider Universal LLM** — including free Ollama local
6. **🦞 OpenClaw Agent Skills** — GraphRAG as autonomous agent capabilities
7. **📊 Live Benchmark Button** — run real evaluations from the dashboard
8. **💰 12-Provider Cost Comparison** — real-time projections

---

## 📊 Benchmarks

### Live Benchmark (Run from Dashboard)
Click **"🏃 Run Benchmark Now"** in the Benchmark tab to evaluate both pipelines on 10 HotpotQA questions with your configured provider. Results populate real-time with F1, EM, token counts, costs.

### Expected Results (HotpotQA)
| Metric | Baseline RAG | GraphRAG | Winner |
|--------|-------------|----------|--------|
| **F1 Score** | ~0.45–0.60 | ~0.55–0.70 | ✅ GraphRAG |
| **Exact Match** | ~0.30–0.45 | ~0.35–0.50 | ✅ GraphRAG |
| **Tokens/Query** | ~800–1000 | ~2000–2800 | ✅ Baseline |
| **F1 Win Rate** | — | ~55–70% | ✅ GraphRAG |

> **Key Finding:** GraphRAG consistently outperforms baseline on multi-hop questions (bridge type) where connecting facts across documents is required. The token overhead is 2–3×, but the Adaptive Router eliminates this cost for simple queries.

---

## 🦞 OpenClaw Integration

Full CIK model (Capability + Identity + Knowledge):

| File | Purpose |
|------|---------|
| `openclaw/SOUL.md` | Agent identity, values, personality |
| `openclaw/IDENTITY.md` | Configuration, supported providers |
| `openclaw/MEMORY.md` | Learned facts about GraphRAG |
| `openclaw/skills/graph_query/` | NL → knowledge graph traversal |
| `openclaw/skills/compare_pipelines/` | Dual-pipeline comparison |
| `openclaw/skills/cost_estimate/` | 12-provider cost projection |

---

## 🧪 Testing

```bash
# Run all 31 unit tests
python tests/test_core.py

# Tests cover:
# - cosine_similarity (5 cases including edge cases)
# - chunk_text (4 cases: basic, empty, short, overlap)
# - entity ID generation (3 cases: deterministic, case-insensitive, type-different)
# - F1/EM computation (5 cases: perfect, partial, no overlap, empty)
# - context hit rate (2 cases)
# - token efficiency (3 cases)
# - provider registry (4 cases: completeness, fields, ollama free, available)
# - evaluation layer aggregate + report (2 cases)
```

---

## 🐳 Deployment

### Docker
```bash
docker build -t graphrag .
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e OPENAI_API_KEY=sk-... \
  graphrag
```

### Vercel
```bash
cd web
npx vercel --prod
```

### Env Variables
```bash
# Set any/all — system auto-detects available providers
ANTHROPIC_API_KEY=sk-ant-...   # Claude
OPENAI_API_KEY=sk-...          # GPT-4o
GEMINI_API_KEY=AIza...         # Gemini
GROQ_API_KEY=gsk_...           # Groq (ultra-fast)
DEEPSEEK_API_KEY=sk-...        # DeepSeek (cheapest)
# Or: ollama pull llama3.2     # Free, local
```

---

## 📁 Project Structure (68 files, 240KB)

```
├── web/                            # Next.js 15 Dashboard
│   ├── src/app/
│   │   ├── globals.css             # 14KB fused TigerGraph×Claude design system
│   │   └── api/
│   │       ├── compare/route.ts    # Multi-provider dual-pipeline API
│   │       ├── benchmark/route.ts  # Live benchmark runner with F1/EM
│   │       └── providers/route.ts  # Available providers + Ollama health
│   ├── src/components/tabs/
│   │   ├── LiveCompare.tsx         # Provider selector + side-by-side comparison
│   │   ├── Benchmark.tsx           # Live "Run Now" + radar/bar charts
│   │   ├── CostAnalysis.tsx        # 12-provider cost projections
│   │   └── GraphExplorer.tsx       # Interactive SVG knowledge graph
│   └── src/lib/
│       ├── llm-providers.ts        # 12-provider universal client (18KB)
│       └── design-tokens.ts        # Color + typography tokens
│
├── openclaw/                       # OpenClaw Agent (CIK model)
│   ├── SOUL.md / IDENTITY.md / MEMORY.md
│   └── skills/ (3 skills)
│
├── graphrag/                       # Python Backend
│   └── layers/
│       ├── graph_layer.py          # TigerGraph schema + GSQL
│       ├── orchestration_layer.py  # Dual pipeline + adaptive router
│       ├── llm_layer.py            # LLM interactions
│       ├── evaluation_layer.py     # RAGAS + F1/EM
│       └── universal_llm.py        # LiteLLM 12-provider support
│
├── tests/test_core.py              # 31 unit tests
├── Dockerfile                      # One-command deployment
└── README.md
```

---

## 📚 References

1. [GraphRAG](https://arxiv.org/abs/2404.16130) — From Local to Global
2. [LightRAG](https://arxiv.org/abs/2410.05779) — Simple and Fast (34K⭐)
3. [OpenClaw](https://github.com/Gen-Verse/OpenClaw) — Personal AI Agent
4. [HotpotQA](https://arxiv.org/abs/1809.09600) — Multi-hop QA
5. [RAGAS](https://arxiv.org/abs/2309.15217) — RAG Evaluation
6. [Youtu-GraphRAG](https://arxiv.org/abs/2508.19855) — Schema-Bounded

[TigerGraph](https://tgcloud.io) · [Anthropic](https://anthropic.com) · [Ollama](https://ollama.ai) · [Groq](https://groq.com) · [LiteLLM](https://litellm.ai) · [Next.js](https://nextjs.org) · [Recharts](https://recharts.org)

---

<div align="center">

### 🏆 Built for the GraphRAG Inference Hackathon by TigerGraph

**12 LLM Providers** · **OpenClaw Agent** · **Ollama Local** · **TigerGraph** · **Next.js 15** · **31 Unit Tests** · **Docker**

</div>
