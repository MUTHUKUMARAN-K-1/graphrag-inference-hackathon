"use client";

import Link from "next/link";

export function HeroSection() {
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: "-30%", right: "-10%",
        width: "700px", height: "700px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,107,0,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", left: "-5%",
        width: "500px", height: "500px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,114,206,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="container" style={{ paddingTop: "80px", paddingBottom: "32px", position: "relative" }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="flex items-center gap-3 mb-8 animate-fade-in-up">
              <span className="badge-glow" style={{ fontSize: "0.75rem" }}>🏆 Hackathon 2025</span>
              <span className="badge-outline" style={{ fontSize: "0.75rem" }}>Powered by TigerGraph</span>
            </div>

            <h1 className="display-hero mb-8 animate-fade-in-up delay-100">
              Graphs make{" "}
              <br className="hidden sm:block" />
              LLM inference{" "}
              <span className="gradient-text-orange">smarter</span>
            </h1>

            <p className="body-lg mb-10 animate-fade-in-up delay-200" style={{ maxWidth: "540px", color: "#3d3d3a" }}>
              A 3-pipeline system that routes queries through knowledge graphs
              when it matters — cutting tokens by 58%, resolving multi-hop questions via entity-graph traversal,
              and delivering measurably better answers.
            </p>

            <div className="flex flex-wrap gap-4 animate-fade-in-up delay-300">
              <Link href="/playground" className="btn btn-primary btn-lg no-underline">
                Try Live Demo
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
              <Link href="/benchmarks" className="btn btn-secondary btn-lg no-underline">
                View Benchmarks
              </Link>
            </div>
          </div>

          <div className="animate-fade-in-up delay-400">
            <div className="code-window animate-float" style={{ boxShadow: "0 20px 60px rgba(0,43,73,0.12)" }}>
              <div className="code-window-header">
                <div className="code-window-dot code-window-dot-red" />
                <div className="code-window-dot code-window-dot-yellow" />
                <div className="code-window-dot code-window-dot-green" />
                <span className="body-sm" style={{ color: "#a09d96", marginLeft: "12px" }}>
                  graphrag_pipeline.py
                </span>
              </div>
              <div style={{ padding: "28px", fontFamily: "var(--font-mono)", fontSize: "0.8125rem", lineHeight: "2" }}>
                <div style={{ color: "#6c6a64" }}>{"# AI Factory Model — 4-Layer Architecture"}</div>
                <br />
                <div>
                  <span style={{ color: "#FF6B00" }}>class</span>
                  <span style={{ color: "#faf9f5" }}> GraphRAGPipeline</span>
                  <span style={{ color: "#6c6a64" }}>:</span>
                </div>
                <div style={{ paddingLeft: "24px" }}>
                  <span style={{ color: "#5db8a6" }}>graph</span>
                  <span style={{ color: "#6c6a64" }}>{" = "}</span>
                  <span style={{ color: "#e8a55a" }}>TigerGraphCloud</span>
                  <span style={{ color: "#6c6a64" }}>()</span>
                </div>
                <div style={{ paddingLeft: "24px" }}>
                  <span style={{ color: "#5db8a6" }}>router</span>
                  <span style={{ color: "#6c6a64" }}>{" = "}</span>
                  <span style={{ color: "#e8a55a" }}>AdaptiveQueryRouter</span>
                  <span style={{ color: "#6c6a64" }}>()</span>
                </div>
                <div style={{ paddingLeft: "24px" }}>
                  <span style={{ color: "#5db8a6" }}>llm</span>
                  <span style={{ color: "#6c6a64" }}>{" = "}</span>
                  <span style={{ color: "#e8a55a" }}>UniversalLLM</span>
                  <span style={{ color: "#6c6a64" }}>(</span>
                  <span style={{ color: "#cc785c" }}>&quot;gemini-2.5-flash&quot;</span>
                  <span style={{ color: "#6c6a64" }}>)</span>
                </div>
                <div style={{ paddingLeft: "24px" }}>
                  <span style={{ color: "#5db8a6" }}>eval</span>
                  <span style={{ color: "#6c6a64" }}>{" = "}</span>
                  <span style={{ color: "#e8a55a" }}>RAGASEvaluator</span>
                  <span style={{ color: "#6c6a64" }}>()</span>
                </div>
                <br />
                <div style={{ paddingLeft: "24px" }}>
                  <span style={{ color: "#FF6B00" }}>def</span>
                  <span style={{ color: "#faf9f5" }}> query</span>
                  <span style={{ color: "#6c6a64" }}>(self, q):</span>
                </div>
                <div style={{ paddingLeft: "48px" }}>
                  <span style={{ color: "#6c6a64" }}>route = self.router.</span>
                  <span style={{ color: "#5db872" }}>classify</span>
                  <span style={{ color: "#6c6a64" }}>(q)</span>
                </div>
                <div style={{ paddingLeft: "48px" }}>
                  <span style={{ color: "#6c6a64" }}>context = self.graph.</span>
                  <span style={{ color: "#5db872" }}>traverse</span>
                  <span style={{ color: "#6c6a64" }}>(q)</span>
                </div>
                <div style={{ paddingLeft: "48px" }}>
                  <span style={{ color: "#FF6B00" }}>return</span>
                  <span style={{ color: "#6c6a64" }}> self.llm.</span>
                  <span style={{ color: "#5db872" }}>generate</span>
                  <span style={{ color: "#6c6a64" }}>(context) </span>
                  <span style={{ color: "#5db872" }}>✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
