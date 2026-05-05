"use client";

const LAYERS = [
  {
    number: "01",
    name: "Graph Layer",
    tech: "TigerGraph Cloud",
    color: "#e8a55a",
    icon: "🔶",
    description: "Foundation of the system. TigerGraph stores entities, relationships, and their properties as a native graph. GSQL queries enable multi-hop traversal that would be prohibitively expensive with traditional databases.",
    capabilities: [
      "Entity storage with typed vertices (PERSON, LOCATION, WORK, etc.)",
      "Relationship edges with properties (BORN_IN, DIRECTED, etc.)",
      "GSQL queries for 1-hop, 2-hop, and multi-hop traversal",
      "Schema-bounded extraction — only valid vertex types accepted",
      "Real-time graph updates via ingestion pipeline",
    ],
    code: `# GSQL Multi-Hop Query
CREATE QUERY find_connections(VERTEX<Entity> start, INT hops) {
  Start = {start};
  FOREACH i IN RANGE[1, hops] DO
    Start = SELECT t
            FROM Start:s -(HAS_RELATION:e)-> Entity:t
            ACCUM @@paths += (s, e.relation, t);
  END;
  PRINT @@paths;
}`,
  },
  {
    number: "02",
    name: "Orchestration Layer",
    tech: "Dual Pipeline Router",
    color: "#0072CE",
    icon: "🔀",
    description: "The brain of the system. Analyzes incoming queries, classifies their complexity, and routes them through the appropriate pipeline — Baseline RAG for simple queries, GraphRAG for complex multi-hop questions.",
    capabilities: [
      "Adaptive Query Router — complexity scoring (0.0–1.0)",
      "Query type classification (bridge, comparison, factoid)",
      "Dual-Level Keyword extraction (high-level concepts + low-level entities)",
      "Pipeline A: Query → Vector Search → LLM (fast, cheap)",
      "Pipeline B: Query → Entity Extraction → Graph Traversal → LLM (precise)",
    ],
    code: `# Adaptive Query Router
class AdaptiveRouter:
  def classify(self, query: str) -> RouteDecision:
    complexity = self.score_complexity(query)
    query_type = self.detect_type(query)  # bridge/comparison/factoid

    if complexity > 0.6 or query_type == "bridge":
      return Route.GRAPHRAG
    return Route.BASELINE`,
  },
  {
    number: "03",
    name: "LLM Layer",
    tech: "12 Providers via Universal API",
    color: "#cc785c",
    icon: "🤖",
    description: "Universal LLM abstraction that supports 12 providers through a single API. Swap between Claude, GPT-4, Gemini, Llama, and more with one parameter change — no code modifications needed.",
    capabilities: [
      "Anthropic Claude (Sonnet 4, Haiku 4)",
      "OpenAI (GPT-4o, GPT-4o-mini)",
      "Google Gemini (2.0 Flash, Pro)",
      "Meta Llama via Groq / Together / HuggingFace",
      "Mistral, DeepSeek, Cohere, xAI Grok, OpenRouter",
      "Local: Ollama for fully offline inference",
    ],
    code: `# Universal LLM — one interface, 12 providers
llm = UniversalLLM(provider="anthropic", model="claude-sonnet-4")
response = llm.generate(
  context=graph_evidence,
  query=user_question,
  max_tokens=500
)
# Switch provider with one line:
llm = UniversalLLM(provider="groq", model="llama-3.3-70b")`,
  },
  {
    number: "04",
    name: "Evaluation Layer",
    tech: "RAGAS + F1/EM + Cost Tracking",
    color: "#5db8a6",
    icon: "📊",
    description: "Automated evaluation that measures every query. Computes F1 score, Exact Match, RAGAS metrics, token usage, latency, and USD cost for both pipelines. Powers the benchmark dashboard and cost projections.",
    capabilities: [
      "F1 Score — token-level overlap with ground truth",
      "Exact Match — binary correctness metric",
      "RAGAS integration — faithfulness, relevancy, context metrics",
      "Token counting — input/output per provider",
      "Cost tracking — USD per query based on provider pricing",
      "Latency measurement — end-to-end milliseconds",
    ],
    code: `# Evaluation Layer
evaluator = RAGASEvaluator()
metrics = evaluator.evaluate(
  query=question,
  answer=llm_response,
  ground_truth=reference_answer,
  context=retrieved_context
)
# Returns: { f1: 0.89, em: 1.0, tokens: 2400,
#            cost_usd: 0.0096, latency_ms: 1800 }`,
  },
];

export function ArchitectureContent() {
  return (
    <div>
      {/* Hero */}
      <section style={{
        background: "linear-gradient(135deg, #002B49 0%, #003D6B 50%, #002B49 100%)",
        padding: "96px 0 80px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-50%", right: "-20%",
          width: "800px", height: "800px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,107,0,0.08) 0%, transparent 70%)",
        }} />
        <div className="container" style={{ position: "relative" }}>
          <div className="badge mb-4" style={{ background: "rgba(255,107,0,0.15)", color: "#FF6B00", fontSize: "0.75rem" }}>
            🏗️ System Design
          </div>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2.5rem, 5vw, 4rem)",
            fontWeight: 400,
            color: "white",
            letterSpacing: "-1.5px",
            marginBottom: "16px",
          }}>
            Architecture
          </h1>
          <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.6)", maxWidth: "560px", lineHeight: 1.6 }}>
            A 4-layer AI Factory model inspired by the GraphRAG and LightRAG papers,
            built on TigerGraph for graph storage and traversal.
          </p>

          {/* Layer Overview Diagram */}
          <div className="mt-12 grid grid-cols-4 gap-3">
            {LAYERS.map((layer, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${layer.color}30`,
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>{layer.icon}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: layer.color, marginBottom: "4px" }}>
                  Layer {layer.number}
                </div>
                <div style={{ color: "white", fontWeight: 500, fontSize: "0.875rem" }}>
                  {layer.name}
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", marginTop: "4px" }}>
                  {layer.tech}
                </div>
              </div>
            ))}
          </div>

          {/* Flow arrows */}
          <div className="flex justify-center items-center mt-6 gap-2">
            <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
              Query → Graph → Orchestration → LLM → Evaluation → Answer
            </span>
          </div>
        </div>
      </section>

      {/* Layer Details */}
      <section className="section">
        <div className="container">
          {LAYERS.map((layer, i) => (
            <div key={i} className="mb-16" style={{ paddingBottom: i < LAYERS.length - 1 ? "64px" : "0", borderBottom: i < LAYERS.length - 1 ? "1px solid var(--color-hairline-soft)" : "none" }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* Info */}
                <div className={i % 2 === 0 ? "" : "lg:order-2"}>
                  <div className="flex items-center gap-3 mb-4">
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.8125rem",
                      color: layer.color, fontWeight: 700,
                    }}>
                      Layer {layer.number}
                    </span>
                    <div className="divider" style={{ background: layer.color }} />
                  </div>
                  <h2 className="display-md mb-2">{layer.name}</h2>
                  <div className="badge mb-4" style={{
                    background: `${layer.color}12`, color: layer.color, fontSize: "0.75rem",
                  }}>
                    {layer.tech}
                  </div>
                  <p className="body-lg mb-6" style={{ color: "var(--color-muted)", lineHeight: 1.7 }}>
                    {layer.description}
                  </p>

                  {/* Capabilities */}
                  <div className="flex flex-col gap-2.5">
                    {layer.capabilities.map((cap, j) => (
                      <div key={j} className="flex items-start gap-3">
                        <div style={{
                          width: "6px", height: "6px", borderRadius: "50%",
                          background: layer.color, marginTop: "8px", flexShrink: 0,
                        }} />
                        <span className="body-sm" style={{ color: "var(--color-body)" }}>{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code */}
                <div className={i % 2 === 0 ? "" : "lg:order-1"}>
                  <div className="code-window">
                    <div className="code-window-header">
                      <div className="code-window-dot code-window-dot-red" />
                      <div className="code-window-dot code-window-dot-yellow" />
                      <div className="code-window-dot code-window-dot-green" />
                      <span className="body-sm" style={{ color: "#a09d96", marginLeft: "12px" }}>
                        {layer.name.toLowerCase().replace(/\s/g, "_")}.py
                      </span>
                    </div>
                    <pre className="code-window-body" style={{ fontSize: "0.8125rem", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                      {layer.code}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="section" style={{ background: "var(--color-surface-soft)" }}>
        <div className="container">
          <div className="text-center mb-12">
            <div className="caption-uppercase mb-3" style={{ color: "var(--color-tiger-orange)" }}>Tech Stack</div>
            <h2 className="display-lg">Built with modern tools</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "TigerGraph", role: "Graph Database", icon: "🔶" },
              { name: "Claude", role: "Primary LLM", icon: "🤖" },
              { name: "Python", role: "Backend", icon: "🐍" },
              { name: "Next.js", role: "Frontend", icon: "⚡" },
              { name: "Recharts", role: "Visualizations", icon: "📊" },
              { name: "Docker", role: "Deployment", icon: "🐳" },
              { name: "RAGAS", role: "Evaluation", icon: "📋" },
              { name: "Wikipedia Science", role: "Benchmark Data", icon: "📚" },
            ].map((tech, i) => (
              <div key={i} className="card card-hover text-center" style={{ padding: "28px 16px" }}>
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>{tech.icon}</div>
                <div className="title-sm">{tech.name}</div>
                <div className="caption" style={{ marginTop: "2px" }}>{tech.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
