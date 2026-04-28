"use client";

const STEPS = [
  {
    number: "01",
    title: "Query Enters the System",
    description: "A natural language question arrives. The Adaptive Router analyzes complexity, entity count, and multi-hop indicators to classify the query.",
    detail: "Complexity score: 0.0–1.0 | Types: bridge, comparison, factoid",
    color: "#FF6B00",
  },
  {
    number: "02",
    title: "Dual Pipeline Activation",
    description: "Both pipelines execute simultaneously: Baseline RAG (vector search → LLM) and GraphRAG (entity extraction → graph traversal → LLM).",
    detail: "Schema-bounded extraction ensures valid entities | GSQL multi-hop traversal",
    color: "#0072CE",
  },
  {
    number: "03",
    title: "Graph Traversal & Evidence",
    description: "TigerGraph traces entity→relation→entity paths through the knowledge graph, collecting structured evidence that the LLM can follow.",
    detail: "2-hop traversal | Reasoning paths | Dual-level keywords",
    color: "#5db8a6",
  },
  {
    number: "04",
    title: "LLM Generation & Evaluation",
    description: "Claude (or any of 12 providers) generates answers from the structured context. RAGAS evaluates F1, Exact Match, and quality metrics in real-time.",
    detail: "Cost tracking | Token counting | Latency measurement",
    color: "#cc785c",
  },
];

export function HowItWorks() {
  return (
    <section className="section" style={{ background: "var(--color-surface-soft)" }}>
      <div className="container">
        <div className="text-center mb-16">
          <div className="caption-uppercase mb-3" style={{ color: "var(--color-tiger-orange)" }}>
            How It Works
          </div>
          <h2 className="display-lg mb-4">From query to answer<br />in four steps</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {STEPS.map((step, i) => (
            <div key={i} className="card card-hover" style={{ position: "relative", overflow: "hidden" }}>
              {/* Step Number */}
              <div style={{
                position: "absolute", top: "-12px", right: "-8px",
                fontFamily: "var(--font-serif)",
                fontSize: "6rem",
                fontWeight: 700,
                color: step.color,
                opacity: 0.06,
                lineHeight: 1,
              }}>
                {step.number}
              </div>

              <div className="flex gap-4">
                <div style={{
                  width: "48px", height: "48px", borderRadius: "12px",
                  background: `${step.color}12`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700, fontSize: "0.875rem",
                  color: step.color,
                  flexShrink: 0,
                }}>
                  {step.number}
                </div>
                <div>
                  <h3 className="title-md mb-2">{step.title}</h3>
                  <p className="body-sm mb-3" style={{ color: "var(--color-muted)" }}>
                    {step.description}
                  </p>
                  <div style={{
                    padding: "8px 12px",
                    background: "var(--color-surface-soft)",
                    borderRadius: "8px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    color: "var(--color-muted)",
                  }}>
                    {step.detail}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
