"use client";

import { useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
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

export function Benchmark() {
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState(10);
  const [data, setData] = useState<AggregateData>(INITIAL);
  const [report, setReport] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [hasResults, setHasResults] = useState(false);

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

      // Build report text
      const a = result.aggregate;
      const lines = [
        `BENCHMARK RESULTS (${a.numSamples} samples, ${result.provider}/${result.model})`,
        `${result.demoMode ? "⚠️ DEMO MODE — Set API key for real results" : "✅ LIVE RESULTS"}`,
        "",
        `Metric                Baseline     GraphRAG     Winner`,
        `${"─".repeat(60)}`,
        `Avg F1                ${a.baseline.avgF1.toFixed(4)}       ${a.graphrag.avgF1.toFixed(4)}       ${a.graphrag.avgF1 > a.baseline.avgF1 ? "GraphRAG" : "Baseline"}`,
        `Avg EM                ${a.baseline.avgEM.toFixed(4)}       ${a.graphrag.avgEM.toFixed(4)}       ${a.graphrag.avgEM > a.baseline.avgEM ? "GraphRAG" : "Baseline"}`,
        `Avg Tokens            ${a.baseline.avgTokens}            ${a.graphrag.avgTokens}            ${a.baseline.avgTokens < a.graphrag.avgTokens ? "Baseline" : "GraphRAG"}`,
        `Avg Cost ($)          ${a.baseline.avgCost.toFixed(6)}   ${a.graphrag.avgCost.toFixed(6)}`,
        `Avg Latency (ms)      ${a.baseline.avgLatency}            ${a.graphrag.avgLatency}`,
        "",
        `GraphRAG F1 Win Rate: ${(a.graphragF1WinRate * 100).toFixed(0)}%`,
        `Token Ratio: ${a.graphrag.avgTokens > 0 && a.baseline.avgTokens > 0 ? (a.graphrag.avgTokens / a.baseline.avgTokens).toFixed(1) : "N/A"}x`,
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

  return (
    <div>
      {/* Controls */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="display-sm mb-2">Batch Benchmark</div>
            <p className="body-sm" style={{ color: "#6c6a64" }}>
              Run both pipelines on HotpotQA questions and evaluate F1, EM, tokens, cost
            </p>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <label className="caption">
              Samples
              <input type="range" min={5} max={10} step={1} value={samples}
                onChange={e => setSamples(+e.target.value)} className="block w-32 mt-1 accent-[#FF6B00]" />
              <span className="body-sm font-mono">{samples}</span>
            </label>
            <button className="btn btn-primary" onClick={runBenchmark} disabled={running}>
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Running…
                </span>
              ) : "🏃 Run Benchmark Now"}
            </button>
          </div>
        </div>
        {demoMode && hasResults && (
          <div className="mt-3 body-sm" style={{ color: "#d4a017" }}>
            ⚠️ Demo mode — showing simulated results. Set an API key for real benchmark data.
          </div>
        )}
      </div>

      {hasResults && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Avg F1 (Baseline)", value: data.baseline.avgF1.toFixed(4), color: "#0072CE" },
              { label: "Avg F1 (GraphRAG)", value: data.graphrag.avgF1.toFixed(4), color: "#FF6B00" },
              { label: "GraphRAG Win Rate", value: (data.graphragF1WinRate * 100).toFixed(0) + "%", color: "#5db872" },
              { label: "Samples Evaluated", value: data.numSamples.toString(), color: "#002B49" },
            ].map((m, i) => (
              <div key={i} className="card-cream text-center" style={{ padding: "20px" }}>
                <div className="metric-value-sm" style={{ color: m.color }}>{m.value}</div>
                <div className="metric-label">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Radar */}
            {radarData.length > 0 && (
              <div className="card">
                <div className="title-md mb-4">Multi-Metric Radar</div>
                <ResponsiveContainer width="100%" height={340}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#002B49" strokeOpacity={0.12} />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#6c6a64", fontSize: 12 }} />
                    <Radar name="Baseline" dataKey="Baseline" stroke="#0072CE" fill="#0072CE" fillOpacity={0.15} strokeWidth={2} />
                    <Radar name="GraphRAG" dataKey="GraphRAG" stroke="#FF6B00" fill="#FF6B00" fillOpacity={0.15} strokeWidth={2} />
                    <Legend /><Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "8px" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* By Type */}
            {typeData.length > 0 && (
              <div className="card">
                <div className="title-md mb-4">F1 by Question Type</div>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={typeData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#002B49" strokeOpacity={0.08} />
                    <XAxis dataKey="name" tick={{ fill: "#6c6a64", fontSize: 13 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#6c6a64", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "8px" }} />
                    <Legend />
                    <Bar dataKey="Baseline" fill="#0072CE" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="GraphRAG" fill="#FF6B00" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Detailed Table */}
          <div className="card mb-6">
            <div className="title-md mb-4">Detailed Comparison</div>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--color-hairline)" }}>
                    {["Metric", "Baseline RAG", "GraphRAG", "Winner"].map(h => (
                      <th key={h} className="caption-uppercase text-left" style={{ padding: "12px 16px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: "Avg F1 Score", b: data.baseline.avgF1.toFixed(4), g: data.graphrag.avgF1.toFixed(4), winner: data.graphrag.avgF1 > data.baseline.avgF1 ? "graphrag" : "baseline" },
                    { metric: "Avg Exact Match", b: data.baseline.avgEM.toFixed(4), g: data.graphrag.avgEM.toFixed(4), winner: data.graphrag.avgEM > data.baseline.avgEM ? "graphrag" : "baseline" },
                    { metric: "Avg Tokens/Query", b: data.baseline.avgTokens.toString(), g: data.graphrag.avgTokens.toString(), winner: data.baseline.avgTokens < data.graphrag.avgTokens ? "baseline" : "graphrag" },
                    { metric: "Avg Cost ($)", b: "$" + data.baseline.avgCost.toFixed(6), g: "$" + data.graphrag.avgCost.toFixed(6), winner: data.baseline.avgCost < data.graphrag.avgCost ? "baseline" : "graphrag" },
                    { metric: "Avg Latency (ms)", b: data.baseline.avgLatency.toString(), g: data.graphrag.avgLatency.toString(), winner: data.baseline.avgLatency < data.graphrag.avgLatency ? "baseline" : "graphrag" },
                    { metric: "F1 Win Rate", b: ((1 - data.graphragF1WinRate) * 100).toFixed(0) + "%", g: (data.graphragF1WinRate * 100).toFixed(0) + "%", winner: data.graphragF1WinRate > 0.5 ? "graphrag" : "baseline" },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--color-hairline-soft)" }}>
                      <td className="title-sm" style={{ padding: "12px 16px" }}>{row.metric}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "#0072CE" }}>{row.b}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "#FF6B00" }}>{row.g}</td>
                      <td style={{ padding: "12px 16px" }}>
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
        </>
      )}

      {/* Report */}
      {report && (
        <div className="card-dark">
          <div className="code-window-header">
            <div className="code-window-dot code-window-dot-red" />
            <div className="code-window-dot code-window-dot-yellow" />
            <div className="code-window-dot code-window-dot-green" />
            <span className="body-sm" style={{ color: "#a09d96", marginLeft: "8px" }}>benchmark_report.txt</span>
          </div>
          <pre className="code-window-body" style={{ whiteSpace: "pre-wrap", fontSize: "0.8125rem" }}>
            {report}
          </pre>
        </div>
      )}
    </div>
  );
}
