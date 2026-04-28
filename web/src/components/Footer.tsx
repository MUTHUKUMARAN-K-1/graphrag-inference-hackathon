"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer style={{ background: "var(--color-surface-dark)", color: "var(--color-on-dark-soft)", padding: "80px 0 32px" }}>
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="#FF6B00" strokeWidth="2.5" />
                <circle cx="16" cy="16" r="5" fill="#FF6B00" />
              </svg>
              <span className="title-lg" style={{ color: "var(--color-on-dark)" }}>
                Graph<span style={{ color: "#FF6B00" }}>RAG</span>
              </span>
            </div>
            <p className="body-sm" style={{ color: "var(--color-on-dark-soft)", maxWidth: "280px", lineHeight: 1.6 }}>
              Proving that graphs make LLM inference faster, cheaper, and smarter — with real measured numbers.
            </p>
          </div>
          <div>
            <div className="caption-uppercase mb-4" style={{ color: "var(--color-on-dark)" }}>Pages</div>
            {[
              { label: "Home", href: "/" },
              { label: "Playground", href: "/playground" },
              { label: "Benchmarks", href: "/benchmarks" },
              { label: "Graph Explorer", href: "/explorer" },
              { label: "Architecture", href: "/architecture" },
              { label: "Documentation", href: "/docs" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="body-sm block mb-2 hover:text-tiger-orange transition-colors no-underline"
                style={{ color: "var(--color-on-dark-soft)" }}>
                {item.label}
              </Link>
            ))}
          </div>
          <div>
            <div className="caption-uppercase mb-4" style={{ color: "var(--color-on-dark)" }}>Architecture</div>
            {["Graph Layer (TigerGraph)", "Orchestration Layer", "LLM Layer (12 Providers)", "Evaluation Layer (RAGAS)"].map((item) => (
              <div key={item} className="body-sm mb-2" style={{ color: "var(--color-on-dark-soft)" }}>{item}</div>
            ))}
          </div>
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
                className="body-sm block mb-2 hover:underline no-underline" style={{ color: "#FF6B00" }}>
                {link.label} ↗
              </a>
            ))}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "24px" }}
          className="flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="body-sm" style={{ color: "var(--color-on-dark-soft)" }}>
            © 2025 GraphRAG Inference Hackathon · TigerGraph × Claude
          </span>
          <div className="flex items-center gap-3">
            <span className="badge" style={{ background: "var(--color-surface-dark-elev)", color: "var(--color-on-dark-soft)", fontSize: "0.6875rem" }}>
              Built with ❤️ for TigerGraph
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
