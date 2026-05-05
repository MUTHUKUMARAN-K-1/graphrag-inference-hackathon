"use client";

import Link from "next/link";

export function BentoShowcase() {
  return (
    <section className="section">
      <div className="container">
        <div className="text-center mb-16">
          <div className="caption-uppercase mb-3" style={{ color: "var(--color-tiger-orange)" }}>
            The Dashboard
          </div>
          <h2 className="display-lg mb-4">Everything in one place</h2>
          <p className="body-lg mx-auto" style={{ maxWidth: "520px", color: "var(--color-muted)" }}>
            Six dedicated pages for every aspect of GraphRAG — from live comparisons to deep graph exploration.
          </p>
        </div>

        <div className="bento-grid bento-grid-3">
          {/* Large: Playground */}
          <Link href="/playground" className="no-underline bento-span-2">
            <div className="card-gradient-orange card-hover" style={{ padding: "40px", minHeight: "240px", cursor: "pointer" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⚡</div>
              <h3 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "white", marginBottom: "8px" }}>
                Live Playground
              </h3>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9375rem", maxWidth: "400px" }}>
                Ask any science question and watch all 3 pipelines run simultaneously —
                LLM-Only, Basic RAG, and GraphRAG. Real-time tokens, cost, and accuracy.
              </p>
              <div className="flex gap-2 mt-4">
                <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: "0.6875rem" }}>12 LLM Providers</span>
                <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: "0.6875rem" }}>Adaptive Routing</span>
              </div>
            </div>
          </Link>

          {/* Small: Benchmarks */}
          <Link href="/benchmarks" className="no-underline">
            <div className="card-dark card-hover" style={{ padding: "32px", minHeight: "240px", cursor: "pointer" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📊</div>
              <h3 className="title-lg" style={{ color: "var(--color-on-dark)", marginBottom: "8px" }}>
                Benchmarks
              </h3>
              <p className="body-sm" style={{ color: "var(--color-on-dark-soft)" }}>
                Run Wikipedia science benchmarks with F1, LLM-Judge, BERTScore, and radar charts.
              </p>
            </div>
          </Link>

          {/* Small: Graph Explorer */}
          <Link href="/explorer" className="no-underline">
            <div className="card card-hover" style={{ padding: "32px", minHeight: "220px", cursor: "pointer", borderColor: "#5db8a6" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🕸️</div>
              <h3 className="title-lg" style={{ marginBottom: "8px" }}>
                Graph Explorer
              </h3>
              <p className="body-sm" style={{ color: "var(--color-muted)" }}>
                Interactive knowledge graph visualization with entity inspection.
              </p>
            </div>
          </Link>

          {/* Medium: Architecture */}
          <Link href="/architecture" className="no-underline bento-span-2">
            <div className="card-gradient-blue card-hover" style={{ padding: "40px", minHeight: "220px", cursor: "pointer" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🏗️</div>
              <h3 style={{ fontSize: "1.375rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "white", marginBottom: "8px" }}>
                Architecture Deep-Dive
              </h3>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.9375rem", maxWidth: "480px" }}>
                Explore the 4-layer AI Factory model, GSQL queries, and how TigerGraph integrates with the LLM pipeline.
              </p>
              <div className="flex gap-2 mt-4">
                <span className="badge" style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: "0.6875rem" }}>4 Layers</span>
                <span className="badge" style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: "0.6875rem" }}>GSQL Queries</span>
                <span className="badge" style={{ background: "rgba(255,255,255,0.15)", color: "white", fontSize: "0.6875rem" }}>Docker Ready</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
