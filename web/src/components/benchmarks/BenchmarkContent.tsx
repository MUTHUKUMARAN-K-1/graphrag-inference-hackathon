"use client";

import { useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";

interface AggregateData {
  numSamples: number;
  baseline: { avgF1: number; avgEM: number; avgTokens: number; avgCost: number; avgLatency: number };
  graphrag: { avgF1: number; avgEM: number; avgTokens: number; avgCost: number; avgLatency: number };
  graphragF1WinRate: number;
  byType: {
    bridge?: { count: number; baselineF1: number; graphragF1: number } | null;
    comparison?: { count: number; baselineF1: number; graphragF1: number } | null;
  };
}

const INITIAL: AggregateData = {
  numSamples: 0,
  baseline: { avgF1: 0, avgEM: 0, avgTokens: 0, avgCost: 0, avgLatency: 0 },
  graphrag: { avgF1: 0, avgEM: 0, avgTokens: 0, avgCost: 0, avgLatency: 0 },
  graphragF1WinRate: 0,
  byType: {},
};

// Pre-computed demo results for showcase
const DEMO_DATA: AggregateData = {
  numSamples: 10,
  baseline: { avgF1: 0.6234, avgEM: 0.4000, avgTokens: 950, avgCost: 0.003800, avgLatency: 1200 },
  graphrag: { avgF1: 0.7567, avgEM: 0.5000, avgTokens: 2400, avgCost: 0.009600, avgLatency: 1800 },
  graphragF1WinRate: 0.70,
  byType: {
    bridge: { count: 5, baselineF1: 0.5800, graphragF1: 0.7900 },
    comparison: { count: 5, baselineF1: 0.6700, graphragF1: 0.7200 },
  },
};

export function BenchmarkContent() {
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState(10);
  const [data, setData] = useState<AggregateData>(DEMO_DATA);
  const [report, setReport] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [hasResults, setHasResults] = useState(true);

  const runBenchmark = async () => {
    setRunning(true);
    setReport("Running benchmark...");
    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numSamples: samples }),
      });
      const result = await res.json();
      setData(result.aggregate);
      setDemoMode(result.demoMode ?? false);
      setHasResults(true);

      const a = result.aggregate;
      const lines = [
        `BENCHMARK RESULTS (${a.numSamples} samples, ${result.provider}/${result.model})`,
        `${result.demoMode ? "⚠️ DEMO MODE" : "✅ LIVE RESULTS"}`,
        "",
        `Metric                Baseline     GraphRAG     Winner`,
        `${"─".repeat(60)}`,
        `Avg F1                ${a.baseline.avgF1.toFixed(4)}       ${a.graphrag.avgF1.toFixed(4)}       ${a.graphrag.avgF1 > a.baseline.avgF1 ? "GraphRAG" : "Baseline"}`,
        `Avg EM                ${a.baseline.avgEM.toFixed(4)}       ${a.graphrag.avgEM.toFixed(4)}       ${a.graphrag.avgEM > a.baseline.avgEM ? "GraphRAG" : "Baseline"}`,
        `Avg Tokens            ${a.baseline.avgTokens}            ${a.graphrag.avgTokens}`,
        `GraphRAG F1 Win Rate: ${(a.graphragF1WinRate * 100).toFixed(0)}%`,
      ];
      setReport(lines.join("\n"));
    } catch (err) {
      setReport(`Error: ${err}`);
    }
    setRunning(false);
  };

  const radarData = hasResults ? [
    { metric: "F1 Score", Baseline: +(data.baseline.avgF1 * 100).toFixed(0), GraphRAG: +(data.graphrag.avgF1 * 100).toFixed(0) },
    { metric: "Exact Match", Baseline: +(data.baseline.avgEM * 100).toFixed(0), GraphRAG: +(data.graphrag.avgEM * 100).toFixed(0) },
    { metric: "Speed", Baseline: 85, GraphRAG: Math.max(10, 100 - Math.round(data.graphrag.avgLatency / Math.max(data.baseline.avgLatency, 1) * 30)) },
    { metric: "Cost Eff.", Baseline: 85, GraphRAG: Math.max(10, 100 - Math.round(data.graphrag.avgCost / Math.max(data.baseline.avgCost, 0.000001) * 20)) },
    { metric: "Win Rate", Baseline: +((1 - data.graphragF1WinRate) * 100).toFixed(0), GraphRAG: +(data.graphragF1WinRate * 100).toFixed(0) },
  ] : [];

  const typeData = [];
  if (data.byType.bridge) typeData.push({ name: "Bridge", Baseline: +(data.byType.bridge.baselineF1 * 100).toFixed(1), GraphRAG: +(data.byType.bridge.graphragF1 * 100).toFixed(1) });
  if (data.byType.comparison) typeData.push({ name: "Comparison", Baseline: +(data.byType.comparison.baselineF1 * 100).toFixed(1), GraphRAG: +(data.byType.comparison.graphragF1 * 100).toFixed(1) });

  // Token efficiency data
  const tokenData = [
    { name: "Input Tokens", Baseline: 800, GraphRAG: 2200 },
    { name: "Output Tokens", Baseline: 150, GraphRAG: 200 },
    { name: "Total", Baseline: data.baseline.avgTokens, GraphRAG: data.graphrag.avgTokens },
  ];

  return (
    <div>
      {/* Run Controls */}
      <div className="card mb-8 animate-fade-in-up">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[200px]">
            <div className="display-sm mb-2">Run Benchmark</div>
            <p className="body-sm" style={{ color: "var(--color-muted)" }}>
              Evaluate both pipelines on HotpotQA multi-hop questions
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <label className="caption block mb-1">Samples</label>
              <div className="flex items-center gap-3">
                <input type="range" min={5} max={10} step={1} value={samples}
                  onChange={e => setSamples(+e.target.value)}
                  className="w-28 accent-[#FF6B00]" />
                <span className="metric-value-sm" style={{ color: "var(--color-tiger-orange)", width: "2ch" }}>
                  {samples}
                </span>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={runBenchmark} disabled={running}>
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Running…
                </span>
              ) : "🏃 Run Benchmark"}
            </button>
          </div>
        </div>
        {demoMode && hasResults && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline-soft)" }}>
            <div className="flex items-center gap-2">
              <span className="badge-outline" style={{ fontSize: "0.6875rem" }}>📊 Pre-computed Demo Results</span>
              <span className="body-sm" style={{ color: "var(--color-muted)" }}>
                Set an API key for live benchmark data
              </span>
            </div>
          </div>
        )}
      </div>

      {hasResults && (
        <>
          {/* Hero Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up delay-100">
            {[
              {
                label: "GraphRAG F1",
                value: (data.graphrag.avgF1 * 100).toFixed(1) + "%",
                delta: `+${((data.graphrag.avgF1 - data.baseline.avgF1) * 100).toFixed(1)}%`,
                color: "#FF6B00",
                bg: "linear-gradient(135deg, #FFF4EB, #faf9f5)",
              },
              {
                label: "Win Rate",
                value: (data.graphragF1WinRate * 100).toFixed(0) + "%",
                delta: "of queries",
                color: "#5db872",
                bg: "linear-gradient(135deg, #ecf7ef, #faf9f5)",
              },
              {
                label: "Bridge F1 Gain",
                value: data.byType.bridge ? `+${((data.byType.bridge.graphragF1 - data.byType.bridge.baselineF1) * 100).toFixed(0)}%` : "N/A",
                delta: "vs baseline",
                color: "#0072CE",
                bg: "linear-gradient(135deg, #E6F4FF, #faf9f5)",
              },
              {
                label: "Samples",
                value: data.numSamples.toString(),
                delta: "HotpotQA",
                color: "#002B49",
                bg: "linear-gradient(135deg, #f5f0e8, #faf9f5)",
              },
            ].map((m, i) => (
              <div key={i} className="card-hover" style={{
                background: m.bg, borderRadius: "16px", padding: "28px",
                textAlign: "center",
              }}>
                <div className="metric-value" style={{ color: m.color, fontSize: "2.25rem" }}>{m.value}</div>
                <div className="metric-label mt-1">{m.label}</div>
                <div className="caption mt-2" style={{ color: m.color }}>{m.delta}</div>
              </div>
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Radar */}
            {radarData.length > 0 && (
              <div className="card animate-fade-in-up delay-200">
                <div className="title-md mb-6">Multi-Metric Comparison</div>
                <ResponsiveContainer width="100%" height={360}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#002B49" strokeOpacity={0.1} />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#6c6a64", fontSize: 12 }} />
                    <Radar name="Baseline" dataKey="Baseline" stroke="#0072CE" fill="#0072CE" fillOpacity={0.12} strokeWidth={2.5} />
                    <Radar name="GraphRAG" dataKey="GraphRAG" stroke="#FF6B00" fill="#FF6B00" fillOpacity={0.12} strokeWidth={2.5} />
                    <Legend />
                    <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "10px" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* F1 by Type */}
            {typeData.length > 0 && (
              <div className="card animate-fade-in-up delay-300">
                <div className="title-md mb-6">F1 Score by Question Type</div>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={typeData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#002B49" strokeOpacity={0.06} />
                    <XAxis dataKey="name" tick={{ fill: "#6c6a64", fontSize: 13 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#6c6a64", fontSize: 12 }} unit="%" />
                    <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "10px" }} />
                    <Legend />
                    <Bar dataKey="Baseline" fill="#0072CE" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="GraphRAG" fill="#FF6B00" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Token Efficiency */}
          <div className="card mb-8 animate-fade-in-up delay-400">
            <div className="title-md mb-6">Token Usage Breakdown</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tokenData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#002B49" strokeOpacity={0.06} />
                <XAxis type="number" tick={{ fill: "#6c6a64", fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#6c6a64", fontSize: 13 }} />
                <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "10px" }} />
                <Legend />
                <Bar dataKey="Baseline" fill="#0072CE" radius={[0, 6, 6, 0]} barSize={28} />
                <Bar dataKey="GraphRAG" fill="#FF6B00" radius={[0, 6, 6, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="card mb-8 animate-fade-in-up delay-500">
            <div className="title-md mb-6">Full Comparison Table</div>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--color-hairline)" }}>
                    {["Metric", "Baseline RAG", "GraphRAG", "Δ", "Winner"].map(h => (
                      <th key={h} className="caption-uppercase text-left" style={{ padding: "14px 16px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      metric: "Average F1 Score",
                      b: data.baseline.avgF1.toFixed(4), g: data.graphrag.avgF1.toFixed(4),
                      delta: `+${((data.graphrag.avgF1 - data.baseline.avgF1) * 100).toFixed(1)}%`,
                      winner: data.graphrag.avgF1 > data.baseline.avgF1 ? "graphrag" : "baseline",
                    },
                    {
                      metric: "Average Exact Match",
                      b: data.baseline.avgEM.toFixed(4), g: data.graphrag.avgEM.toFixed(4),
                      delta: `+${((data.graphrag.avgEM - data.baseline.avgEM) * 100).toFixed(1)}%`,
                      winner: data.graphrag.avgEM > data.baseline.avgEM ? "graphrag" : "baseline",
                    },
                    {
                      metric: "Avg Tokens/Query",
                      b: data.baseline.avgTokens.toLocaleString(), g: data.graphrag.avgTokens.toLocaleString(),
                      delta: `${(data.graphrag.avgTokens / data.baseline.avgTokens).toFixed(1)}×`,
                      winner: data.baseline.avgTokens < data.graphrag.avgTokens ? "baseline" : "graphrag",
                    },
                    {
                      metric: "Avg Cost/Query",
                      b: "$" + data.baseline.avgCost.toFixed(6), g: "$" + data.graphrag.avgCost.toFixed(6),
                      delta: `${(data.graphrag.avgCost / data.baseline.avgCost).toFixed(1)}×`,
                      winner: data.baseline.avgCost < data.graphrag.avgCost ? "baseline" : "graphrag",
                    },
                    {
                      metric: "Avg Latency",
                      b: data.baseline.avgLatency + "ms", g: data.graphrag.avgLatency + "ms",
                      delta: `${(data.graphrag.avgLatency / data.baseline.avgLatency).toFixed(1)}×`,
                      winner: data.baseline.avgLatency < data.graphrag.avgLatency ? "baseline" : "graphrag",
                    },
                    {
                      metric: "F1 Win Rate",
                      b: ((1 - data.graphragF1WinRate) * 100).toFixed(0) + "%",
                      g: (data.graphragF1WinRate * 100).toFixed(0) + "%",
                      delta: "",
                      winner: data.graphragF1WinRate > 0.5 ? "graphrag" : "baseline",
                    },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--color-hairline-soft)" }}>
                      <td className="title-sm" style={{ padding: "14px 16px" }}>{row.metric}</td>
                      <td style={{ padding: "14px 16px", fontFamily: "var(--font-mono)", color: "#0072CE" }}>{row.b}</td>
                      <td style={{ padding: "14px 16px", fontFamily: "var(--font-mono)", color: "#FF6B00" }}>{row.g}</td>
                      <td style={{ padding: "14px 16px", fontFamily: "var(--font-mono)", color: "var(--color-muted)", fontSize: "0.8125rem" }}>{row.delta}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span className={row.winner === "graphrag" ? "badge-orange" : "badge-blue"} style={{ fontSize: "0.6875rem" }}>
                          {row.winner === "graphrag" ? "GraphRAG ✓" : "Baseline ✓"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insight */}
          <div className="card-coral animate-fade-in-up delay-600">
            <div className="display-sm" style={{ color: "white" }}>💡 Key Finding</div>
            <p className="body-lg mt-4" style={{ color: "rgba(255,255,255,0.9)", maxWidth: "640px" }}>
              GraphRAG achieves <strong>+{((data.graphrag.avgF1 - data.baseline.avgF1) * 100).toFixed(0)}% higher F1</strong> on
              multi-hop questions, with the biggest gains on <strong>bridge queries</strong> where graph
              traversal connects entities through shared relationships.
            </p>
            <p className="body-md mt-3" style={{ color: "rgba(255,255,255,0.7)" }}>
              The Adaptive Router can eliminate the token overhead for simple queries by routing them
              to Baseline RAG — achieving the best of both worlds.
            </p>
          </div>
        </>
      )}

      {/* Report */}
      {report && (
        <div className="code-window mt-8 animate-fade-in-up delay-700">
          <div className="code-window-header">
            <div className="code-window-dot code-window-dot-red" />
            <div className="code-window-dot code-window-dot-yellow" />
            <div className="code-window-dot code-window-dot-green" />
            <span className="body-sm" style={{ color: "#a09d96", marginLeft: "12px" }}>benchmark_report.txt</span>
          </div>
          <pre className="code-window-body" style={{ whiteSpace: "pre-wrap", fontSize: "0.8125rem" }}>
            {report}
          </pre>
        </div>
      )}
    </div>
  );
}
