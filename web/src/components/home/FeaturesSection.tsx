"use client";

const FEATURES = [
  {
    icon: "🧠",
    iconClass: "feature-icon-orange",
    title: "Adaptive Query Router",
    description: "Analyzes query complexity in real-time and routes simple questions to fast baseline RAG while directing multi-hop questions through the knowledge graph.",
    tag: "Novel",
    tagColor: "#FF6B00",
  },
  {
    icon: "📋",
    iconClass: "feature-icon-blue",
    title: "Schema-Bounded Extraction",
    description: "Constrains entity extraction to TigerGraph's schema, eliminating hallucinated node types and ensuring every extracted entity maps to a valid graph vertex.",
    tag: "Novel",
    tagColor: "#FF6B00",
  },
  {
    icon: "🔑",
    iconClass: "feature-icon-teal",
    title: "Dual-Level Keywords",
    description: "Extracts both high-level concepts and low-level entities from queries, enabling graph traversal at multiple granularity levels for richer context.",
    tag: "Novel",
    tagColor: "#FF6B00",
  },
  {
    icon: "🔗",
    iconClass: "feature-icon-amber",
    title: "Graph Reasoning Paths",
    description: "Traces explicit entity→relation→entity chains through TigerGraph, providing human-readable evidence paths that make LLM answers verifiable.",
    tag: "Novel",
    tagColor: "#FF6B00",
  },
  {
    icon: "📊",
    iconClass: "feature-icon-coral",
    title: "Real-Time Cost Tracking",
    description: "Measures tokens, latency, and USD cost per query for both pipelines simultaneously, with interactive projections at scale.",
    tag: "Novel",
    tagColor: "#FF6B00",
  },
  {
    icon: "🌐",
    iconClass: "feature-icon-blue",
    title: "12 LLM Providers",
    description: "Universal LLM layer supporting Claude, GPT-4, Gemini, Llama, Mistral, DeepSeek, Grok, Cohere, and more — swap providers with one parameter.",
    tag: "Universal",
    tagColor: "#0072CE",
  },
];

export function FeaturesSection() {
  return (
    <section className="section" style={{ background: "var(--color-canvas)" }}>
      <div className="container">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="caption-uppercase mb-3" style={{ color: "var(--color-tiger-orange)" }}>
            What Makes It Different
          </div>
          <h2 className="display-lg mb-4">Five novel features,<br />one unified system</h2>
          <p className="body-lg mx-auto" style={{ maxWidth: "560px", color: "var(--color-muted)" }}>
            Each feature was designed to solve a specific GraphRAG challenge —
            from query routing to cost optimization.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <div
              key={i}
              className="card card-hover"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`feature-icon ${feature.iconClass}`}>
                {feature.icon}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="title-md">{feature.title}</h3>
                <span className="badge" style={{
                  background: `${feature.tagColor}15`,
                  color: feature.tagColor,
                  fontSize: "0.6875rem",
                  padding: "2px 8px",
                }}>
                  {feature.tag}
                </span>
              </div>
              <p className="body-sm" style={{ color: "var(--color-muted)" }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
