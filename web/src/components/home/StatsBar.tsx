"use client";

export function StatsBar() {
  const stats = [
    { value: "−58%", label: "Token Reduction vs RAG", color: "#FF6B00" },
    { value: "4", label: "AI Factory Layers", color: "#002B49" },
    { value: "12", label: "LLM Providers", color: "#0072CE" },
    { value: "5", label: "Novel Features", color: "#cc785c" },
    { value: "50", label: "Unit Tests", color: "#5db8a6" },
  ];

  return (
    <section style={{ background: "var(--color-surface-dark)", padding: "0" }}>
      <div className="container-wide">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-0">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="text-center animate-fade-in-up"
              style={{
                padding: "32px 16px",
                borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <div className="metric-value" style={{ color: stat.color, fontSize: "2rem" }}>
                {stat.value}
              </div>
              <div className="body-sm" style={{ color: "var(--color-on-dark-soft)", marginTop: "4px" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
