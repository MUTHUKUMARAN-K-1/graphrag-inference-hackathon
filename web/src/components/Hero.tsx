"use client";

export function Hero() {
  return (
    <section className="section" style={{ paddingBottom: "48px" }}>
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="badge-orange">Hackathon 2025</span>
              <span className="badge-outline">TigerGraph × Claude</span>
            </div>

            <h1 className="display-xl mb-6">
              Graphs make LLM inference{" "}
              <span style={{ color: "#FF6B00" }}>faster</span>,{" "}
              <span style={{ color: "#cc785c" }}>cheaper</span>, and{" "}
              <span style={{ color: "#0072CE" }}>smarter</span>
            </h1>

            <p className="body-md mb-8" style={{ maxWidth: "520px", color: "#3d3d3a" }}>
              A dual-pipeline system comparing Baseline RAG vs GraphRAG with real
              numbers. TigerGraph organizes information into relationships that
              Claude can follow — cutting tokens, speeding up responses, and
              saving cost without losing accuracy.
            </p>

            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary btn-lg" onClick={() => document.getElementById("live")?.scrollIntoView({ behavior: "smooth" })}>
                Try Live Comparison →
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => document.getElementById("benchmark")?.scrollIntoView({ behavior: "smooth" })}>
                View Benchmarks
              </button>
            </div>

            {/* Stats row */}
            <div className="flex gap-8 mt-10 pt-8" style={{ borderTop: "1px solid #e6dfd8" }}>
              <div>
                <div className="metric-value" style={{ color: "#FF6B00" }}>+21%</div>
                <div className="metric-label">F1 on Bridge Queries</div>
              </div>
              <div>
                <div className="metric-value" style={{ color: "#0072CE" }}>4 Layers</div>
                <div className="metric-label">AI Factory Architecture</div>
              </div>
              <div>
                <div className="metric-value" style={{ color: "#cc785c" }}>5</div>
                <div className="metric-label">Novel Features</div>
              </div>
            </div>
          </div>

          {/* Right: Architecture Card */}
          <div className="card-dark" style={{ padding: "0", overflow: "hidden" }}>
            <div className="code-window-header">
              <div className="code-window-dot code-window-dot-red" />
              <div className="code-window-dot code-window-dot-yellow" />
              <div className="code-window-dot code-window-dot-green" />
              <span className="body-sm" style={{ color: "#a09d96", marginLeft: "8px" }}>
                architecture.graphrag
              </span>
            </div>
            <div style={{ padding: "24px", fontFamily: "var(--font-mono)", fontSize: "0.8125rem", lineHeight: "1.8" }}>
              <div style={{ color: "#a09d96" }}>{"// AI Factory Model — 4 Layers"}</div>
              <br />
              <div style={{ color: "#faf9f5" }}>
                <span style={{ color: "#FF6B00" }}>Layer 4</span>
                <span style={{ color: "#a09d96" }}>{" │ "}</span>
                <span style={{ color: "#5db8a6" }}>Evaluation</span>
                <span style={{ color: "#a09d96" }}>{" → RAGAS + F1/EM + Dashboard"}</span>
              </div>
              <div style={{ color: "#faf9f5" }}>
                <span style={{ color: "#FF6B00" }}>Layer 3</span>
                <span style={{ color: "#a09d96" }}>{" │ "}</span>
                <span style={{ color: "#cc785c" }}>LLM</span>
                <span style={{ color: "#a09d96" }}>{" ────→ Claude Sonnet 4"}</span>
              </div>
              <div style={{ color: "#faf9f5" }}>
                <span style={{ color: "#FF6B00" }}>Layer 2</span>
                <span style={{ color: "#a09d96" }}>{" │ "}</span>
                <span style={{ color: "#0072CE" }}>Orchestration</span>
                <span style={{ color: "#a09d96" }}>{" → Dual Pipeline Router"}</span>
              </div>
              <div style={{ color: "#faf9f5" }}>
                <span style={{ color: "#FF6B00" }}>Layer 1</span>
                <span style={{ color: "#a09d96" }}>{" │ "}</span>
                <span style={{ color: "#e8a55a" }}>Graph</span>
                <span style={{ color: "#a09d96" }}>{" ──→ TigerGraph Cloud"}</span>
              </div>
              <br />
              <div style={{ color: "#a09d96" }}>{"// Pipeline A: Query → Vector Search → LLM"}</div>
              <div style={{ color: "#a09d96" }}>{"// Pipeline B: Query → Keywords → Graph → LLM"}</div>
              <br />
              <div style={{ color: "#5db872" }}>{"✓ Adaptive Routing  ✓ Schema-Bounded Extraction"}</div>
              <div style={{ color: "#5db872" }}>{"✓ Graph Reasoning   ✓ Dual-Level Keywords"}</div>
              <div style={{ color: "#5db872" }}>{"✓ Cost Tracking     ✓ Real-Time Comparison"}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
