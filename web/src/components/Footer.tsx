"use client";

export function Footer() {
  return (
    <footer style={{ background: "var(--color-surface-dark)", color: "var(--color-on-dark-soft)", padding: "64px 0 32px" }}>
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="#FF6B00" strokeWidth="2" />
                <path d="M14 4L14 24M4 14L24 14M7 7L21 21M21 7L7 21" stroke="#FF6B00" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="title-md" style={{ color: "var(--color-on-dark)" }}>
                Graph<span style={{ color: "#FF6B00" }}>RAG</span>
              </span>
            </div>
            <p className="body-sm" style={{ color: "var(--color-on-dark-soft)", maxWidth: "280px" }}>
              Proving that graphs make LLM inference faster, cheaper, and smarter —
              with real numbers.
            </p>
          </div>

          {/* Architecture */}
          <div>
            <div className="caption-uppercase mb-4" style={{ color: "var(--color-on-dark)" }}>Architecture</div>
            {["Graph Layer (TigerGraph)", "Orchestration Layer", "LLM Layer (Claude)", "Evaluation Layer (RAGAS)"].map((item) => (
              <div key={item} className="body-sm mb-2" style={{ color: "var(--color-on-dark-soft)" }}>{item}</div>
            ))}
          </div>

          {/* Novelties */}
          <div>
            <div className="caption-uppercase mb-4" style={{ color: "var(--color-on-dark)" }}>Novel Features</div>
            {["🧠 Adaptive Query Router", "📋 Schema-Bounded Extraction", "🔑 Dual-Level Keywords", "🔗 Reasoning Paths", "📊 Cost Tracking"].map((item) => (
              <div key={item} className="body-sm mb-2" style={{ color: "var(--color-on-dark-soft)" }}>{item}</div>
            ))}
          </div>

          {/* References */}
          <div>
            <div className="caption-uppercase mb-4" style={{ color: "var(--color-on-dark)" }}>References</div>
            {[
              { label: "GraphRAG Paper", href: "https://arxiv.org/abs/2404.16130" },
              { label: "LightRAG Paper", href: "https://arxiv.org/abs/2410.05779" },
              { label: "HotpotQA Dataset", href: "https://hotpotqa.github.io/" },
              { label: "TigerGraph Cloud", href: "https://tgcloud.io" },
              { label: "Anthropic Claude", href: "https://anthropic.com" },
            ].map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                className="body-sm block mb-2 hover:underline" style={{ color: "#FF6B00" }}>
                {link.label} ↗
              </a>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "24px" }}
          className="flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="body-sm" style={{ color: "var(--color-on-dark-soft)" }}>
            © 2025 GraphRAG Inference Hackathon by TigerGraph
          </span>
          <div className="flex items-center gap-4">
            <span className="badge" style={{ background: "var(--color-surface-dark-elev)", color: "var(--color-on-dark-soft)", fontSize: "0.6875rem" }}>
              TigerGraph × Claude
            </span>
            <span className="badge" style={{ background: "var(--color-surface-dark-elev)", color: "var(--color-on-dark-soft)", fontSize: "0.6875rem" }}>
              Next.js + Recharts
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
