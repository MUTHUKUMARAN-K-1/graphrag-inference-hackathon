"use client";

import { useState } from "react";

const SECTIONS = [
  {
    id: "quickstart",
    title: "Quick Start",
    icon: "🚀",
    content: [
      {
        heading: "Prerequisites",
        body: `Before running GraphRAG, make sure you have:
- Python 3.10+
- Node.js 18+
- Docker (optional, for containerized deployment)
- A TigerGraph Cloud account (free tier available)
- At least one LLM API key (Claude, OpenAI, etc.)`,
      },
      {
        heading: "Installation",
        code: `# Clone the repository
git clone https://github.com/MUTHUKUMARAN-K-1/graphrag-inference-hackathon
cd graphrag-inference-hackathon

# Backend setup
pip install -r requirements.txt

# Frontend setup
cd web
npm install
npm run dev

# Or use Docker
docker build -t graphrag .
docker run -p 3000:3000 -p 8000:8000 graphrag`,
      },
      {
        heading: "Environment Variables",
        code: `# web/.env  (copy from web/.env.example)

# TigerGraph
TG_HOST=https://your-instance.i.tgcloud.io
TG_TOKEN=your_bearer_token
TG_GRAPH=GraphRAG

# LLM — set at least one
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://models.botlearn.ai/v1   # optional: botlearn.ai / other proxy
LLM_MODEL=gemini-2.5-flash                      # optional: override default model

# Embeddings (for live TigerGraph retrieval)
HF_TOKEN=hf_...

# Optional additional providers
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
GROQ_API_KEY=gsk_...`,
      },
    ],
  },
  {
    id: "api",
    title: "API Reference",
    icon: "📡",
    content: [
      {
        heading: "POST /api/compare",
        body: "Run a side-by-side comparison of Baseline RAG and GraphRAG pipelines.",
        code: `// Request
POST /api/compare
{
  "query": "What theory describes gravity as the curvature of spacetime?",
  "provider": "openai",
  "model": "gemini-2.5-flash",
  "adaptiveRouting": true,
  "topK": 5
}

// Response — 3 pipelines run in parallel
{
  "llmOnly": {
    "answer": "General relativity.",
    "tokens": 84,
    "latencyMs": 820,
    "costUsd": 0.000013
  },
  "baseline": {
    "answer": "General relativity, published by Einstein in 1915...",
    "tokens": 290,
    "latencyMs": 1100,
    "costUsd": 0.000044,
    "retrievedChunks": 5,
    "contextTokens": 240
  },
  "graphrag": {
    "answer": "General relativity (Einstein, 1915).",
    "tokens": 163,
    "latencyMs": 950,
    "costUsd": 0.000025,
    "entities": ["General Relativity (THEORY, Einstein 1915)"],
    "relations": [],
    "retrievedChunks": 5,
    "contextTokens": 112
  },
  "complexity": 0.2,
  "queryType": "factoid",
  "recommended": "baseline",
  "totalTimeMs": 2700
}`,
      },
      {
        heading: "POST /api/benchmark",
        body: "Run batch evaluation on 10 science questions from the ingested Wikipedia corpus. All samples run in parallel.",
        code: `// Request
POST /api/benchmark
{ "numSamples": 10, "provider": "openai", "model": "gemini-2.5-flash" }

// Response
{
  "aggregate": {
    "numSamples": 10,
    "llmOnly":  { "avgF1": 0.7000, "avgEM": 0.70, "avgTokens": 84,  "avgLatency": 820 },
    "baseline": { "avgF1": 0.5800, "avgEM": 0.50, "avgTokens": 290, "avgLatency": 1100 },
    "graphrag": { "avgF1": 0.7467, "avgEM": 0.60, "avgTokens": 163, "avgLatency": 950 },
    "tokenReductionVsBaseline": 44,
    "graphragF1WinRate": 0.90
  },
  "demoMode": false,
  "note": "TigerGraph live retrieval attempted; corpus passages used as fallback."
}`,
      },
      {
        heading: "GET /api/providers",
        body: "List all available LLM providers and their models.",
        code: `// Response
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic Claude",
      "isLocal": false,
      "hasApiKey": true,
      "defaultModel": "claude-sonnet-4-20250514",
      "models": [
        { "id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "speed": "medium", "quality": "high" }
      ]
    },
    ...
  ]
}`,
      },
    ],
  },
  {
    id: "architecture",
    title: "Architecture",
    icon: "🏗️",
    content: [
      {
        heading: "4-Layer AI Factory Model",
        body: `The system follows an AI Factory architecture with four distinct layers:

**Layer 1 — Graph Layer (TigerGraph Cloud)**
Stores the knowledge graph with typed vertices and edges. Supports GSQL queries for multi-hop traversal.

**Layer 2 — Orchestration Layer**
Routes queries through the Adaptive Router, which scores complexity and classifies query types (bridge, comparison, factoid).

**Layer 3 — LLM Layer (12 Providers)**
Universal LLM abstraction supporting Claude, GPT-4, Gemini, Llama, Mistral, DeepSeek, Grok, Cohere, and more.

**Layer 4 — Evaluation Layer (RAGAS)**
Automated evaluation with F1, Exact Match, token counting, cost tracking, and latency measurement.`,
      },
      {
        heading: "3-Pipeline Design",
        body: `Every query runs through all three pipelines concurrently (parallel execution):

**Pipeline 1 — LLM-Only**
Query → LLM → Answer
- Fewest tokens (~84/query). Pure parametric knowledge, no retrieval.

**Pipeline 2 — Basic RAG**
Query → Embed → TigerGraph vector search → Full chunk text → LLM
- More tokens (~290/query). Industry-standard retrieval baseline.

**Pipeline 3 — GraphRAG**
Query → Embed → TigerGraph vector search → Compact entity descriptions (pre-indexed) → LLM
- Fewest retrieval tokens (~163/query). −44% vs Basic RAG, +28.7% F1.
- Entity descriptions extracted once at ingest time — amortized cost.`,
      },
    ],
  },
  {
    id: "novelties",
    title: "Novel Features",
    icon: "✨",
    content: [
      {
        heading: "1. Adaptive Query Router",
        body: `Analyzes query complexity (0.0–1.0) using:
- Entity count — more entities = higher complexity
- Multi-hop indicators — "both", "same", "compared to"
- Question word analysis — "which" and "who" patterns
- Dependency chain length

Routes simple queries to Baseline RAG (fast, cheap) and complex queries to GraphRAG (precise, traceable).`,
      },
      {
        heading: "2. Schema-Bounded Extraction",
        body: `Traditional NER extracts arbitrary entity types. Our system constrains extraction to TigerGraph's actual schema:
- Only PERSON, LOCATION, WORK, CONCEPT, etc. (valid vertex types)
- Eliminates hallucinated node types that would fail on graph lookup
- Ensures every extracted entity maps to a real vertex in the graph`,
      },
      {
        heading: "3. Dual-Level Keywords",
        body: `Extracts keywords at two granularity levels:
- **High-level**: Concepts, themes, categories (e.g., "nationality", "American cinema")
- **Low-level**: Specific entities, names, dates (e.g., "Scott Derrickson", "1962")
Enables graph traversal at multiple levels for richer context retrieval.`,
      },
      {
        heading: "4. Graph Reasoning Paths",
        body: `Traces explicit entity→relation→entity chains:
- Scott Derrickson → BORN_IN → Denver, CO → LOCATED_IN → United States
- Ed Wood → BORN_IN → Poughkeepsie, NY → LOCATED_IN → United States

These paths are included in the LLM prompt as structured evidence, making answers verifiable and explainable.`,
      },
      {
        heading: "5. Real-Time Cost Tracking",
        body: `Measures per-query economics:
- Input/output tokens counted per provider's tokenization
- USD cost calculated using current provider pricing
- Latency measured end-to-end (graph + LLM)
- Interactive projections: "What would 100K queries/month cost?"`,
      },
    ],
  },
  {
    id: "deployment",
    title: "Deployment",
    icon: "🐳",
    content: [
      {
        heading: "Docker Deployment",
        code: `# Build the image
docker build -t graphrag .

# Run with environment variables
docker run -d \\
  -p 3000:3000 \\
  -e TG_HOST=https://your-instance.i.tgcloud.io \\
  -e TG_TOKEN=your_bearer_token \\
  -e OPENAI_API_KEY=sk-... \\
  -e HF_TOKEN=hf_... \\
  graphrag`,
      },
      {
        heading: "TigerGraph Cloud Setup",
        body: `1. Create a free account at tgcloud.io
2. Create a new cluster (free tier: 50MB storage)
3. Install the GraphRAG schema:
   - Go to GraphStudio
   - Import the schema from graphrag/setup_tigergraph.py
4. Set TIGERGRAPH_HOST, TIGERGRAPH_GRAPH, TIGERGRAPH_SECRET in .env`,
      },
      {
        heading: "Running Locally",
        code: `# Backend (Python)
cd graphrag-inference-hackathon
pip install -r requirements.txt
python -m graphrag.main

# Frontend (Next.js)
cd web
npm install
npm run dev

# Open http://localhost:3000`,
      },
    ],
  },
];

export function DocsContent() {
  const [activeSection, setActiveSection] = useState("quickstart");

  const section = SECTIONS.find(s => s.id === activeSection) || SECTIONS[0];

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 72px)" }}>
      {/* Sidebar */}
      <aside style={{
        width: "260px",
        flexShrink: 0,
        borderRight: "1px solid var(--color-hairline-soft)",
        padding: "32px 0",
        position: "sticky",
        top: "72px",
        height: "calc(100vh - 72px)",
        overflowY: "auto",
        display: "none",
      }} className="lg:!block">
        <div style={{ padding: "0 24px" }}>
          <div className="caption-uppercase mb-4" style={{ color: "var(--color-tiger-orange)" }}>Documentation</div>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: activeSection === s.id ? "var(--color-tiger-orange-light)" : "transparent",
                  color: activeSection === s.id ? "var(--color-tiger-orange)" : "var(--color-muted)",
                  fontWeight: activeSection === s.id ? 600 : 400,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  width: "100%",
                }}
              >
                <span>{s.icon}</span>
                {s.title}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile Tabs */}
      <div className="lg:hidden" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
        background: "var(--color-canvas)",
        borderTop: "1px solid var(--color-hairline)",
        display: "flex",
        overflowX: "auto",
        padding: "8px",
        gap: "4px",
      }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={activeSection === s.id ? "badge-orange" : "badge-outline"}
            style={{ fontSize: "0.6875rem", whiteSpace: "nowrap", cursor: "pointer", border: "none" }}
          >
            {s.icon} {s.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ flex: 1, padding: "48px 40px 96px", maxWidth: "840px" }}>
        <div className="flex items-center gap-3 mb-2">
          <span style={{ fontSize: "1.5rem" }}>{section.icon}</span>
          <h1 className="display-lg">{section.title}</h1>
        </div>
        <div className="divider mb-8" />

        <div className="flex flex-col gap-10">
          {section.content.map((block, i) => (
            <div key={i}>
              <h2 className="display-sm mb-4">{block.heading}</h2>
              {block.body && (
                <div className="body-lg" style={{ color: "var(--color-body)", lineHeight: 1.75, whiteSpace: "pre-line" }}>
                  {block.body.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return <strong key={j} style={{ color: "var(--color-ink)" }}>{part.slice(2, -2)}</strong>;
                    }
                    return <span key={j}>{part}</span>;
                  })}
                </div>
              )}
              {block.code && (
                <div className="code-window mt-4">
                  <div className="code-window-header">
                    <div className="code-window-dot code-window-dot-red" />
                    <div className="code-window-dot code-window-dot-yellow" />
                    <div className="code-window-dot code-window-dot-green" />
                  </div>
                  <pre className="code-window-body" style={{ fontSize: "0.8125rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {block.code}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
