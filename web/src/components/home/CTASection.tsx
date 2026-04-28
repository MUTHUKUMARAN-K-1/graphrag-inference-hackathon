"use client";

import Link from "next/link";

export function CTASection() {
  return (
    <section style={{
      background: "linear-gradient(135deg, #002B49 0%, #003D6B 50%, #002B49 100%)",
      padding: "96px 0",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Decorative circles */}
      <div style={{
        position: "absolute", top: "-100px", right: "-100px",
        width: "400px", height: "400px", borderRadius: "50%",
        border: "1px solid rgba(255,107,0,0.1)",
      }} />
      <div style={{
        position: "absolute", bottom: "-60px", left: "-60px",
        width: "300px", height: "300px", borderRadius: "50%",
        border: "1px solid rgba(255,107,0,0.08)",
      }} />

      <div className="container text-center" style={{ position: "relative" }}>
        <div className="badge mb-6" style={{ background: "rgba(255,107,0,0.15)", color: "#FF6B00", fontSize: "0.75rem" }}>
          Ready to explore?
        </div>
        <h2 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(2rem, 4vw, 3.5rem)",
          fontWeight: 400,
          color: "white",
          letterSpacing: "-1px",
          lineHeight: 1.1,
          marginBottom: "24px",
        }}>
          See the difference<br />graphs make
        </h2>
        <p style={{
          fontSize: "1.125rem", color: "rgba(255,255,255,0.6)",
          maxWidth: "480px", margin: "0 auto 40px",
          lineHeight: 1.6,
        }}>
          Run a live comparison between Baseline RAG and GraphRAG.
          Measure F1, tokens, cost, and latency — all in your browser.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/playground" className="btn btn-primary btn-lg no-underline">
            Launch Playground →
          </Link>
          <a
            href="https://github.com/MUTHUKUMARAN-K-1/graphrag-inference-hackathon"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-on-dark btn-lg no-underline"
          >
            ⭐ Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
