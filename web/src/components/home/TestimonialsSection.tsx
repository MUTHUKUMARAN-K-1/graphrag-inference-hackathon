"use client";

const TESTIMONIALS = [
  {
    quote: "GraphRAG reduces token usage by routing simple queries to baseline while giving complex multi-hop questions the structured reasoning they need.",
    label: "Adaptive Intelligence",
    icon: "🧠",
    metric: "40% fewer tokens on simple queries",
    bg: "var(--color-canvas)",
  },
  {
    quote: "Schema-bounded extraction ensures every entity maps to a valid TigerGraph vertex — no hallucinated node types, no broken traversals.",
    label: "Graph Integrity",
    icon: "📋",
    metric: "Zero invalid entity types",
    bg: "var(--color-surface-card)",
  },
  {
    quote: "The reasoning path visualization shows exactly which graph edges were traversed, making every LLM answer traceable and verifiable.",
    label: "Explainability",
    icon: "🔗",
    metric: "Full evidence chain per answer",
    bg: "var(--color-canvas)",
  },
];

export function TestimonialsSection() {
  return (
    <section className="section" style={{ background: "var(--color-surface-soft)" }}>
      <div className="container">
        <div className="text-center mb-12">
          <div className="caption-uppercase mb-3" style={{ color: "var(--color-tiger-orange)" }}>
            Key Insights
          </div>
          <h2 className="display-lg">Why graphs change the game</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="card card-hover"
              style={{ background: t.bg }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "16px" }}>{t.icon}</div>
              <div className="caption-uppercase mb-2" style={{ color: "var(--color-tiger-orange)" }}>
                {t.label}
              </div>
              <p className="body-md mb-4" style={{ color: "var(--color-body)" }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div style={{
                padding: "8px 14px",
                background: "var(--color-tiger-orange-light)",
                borderRadius: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--color-tiger-orange)",
              }}>
                {t.metric}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
