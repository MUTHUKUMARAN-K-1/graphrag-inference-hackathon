"use client";

import { useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const DEMO_AGGREGATE = {
  numSamples: 100,
  baseline: { avgF1: 0.5523, avgEM: 0.3810, avgContextHit: 0.4520, avgTokens: 952, avgCost: 0.000203, avgLatency: 1240 },
  graphrag: { avgF1: 0.6241, avgEM: 0.4230, avgContextHit: 0.5830, avgTokens: 2387, avgCost: 0.000518, avgLatency: 3820 },
  f1WinRate: 0.62,
  byType: [
    { type: "bridge", count: 58, baselineF1: 0.52, graphragF1: 0.63 },
    { type: "comparison", count: 42, baselineF1: 0.58, graphragF1: 0.61 },
  ],
};

const radarData = [
  { metric: "F1 Score", Baseline: 55, GraphRAG: 62 },
  { metric: "Exact Match", Baseline: 38, GraphRAG: 42 },
  { metric: "Context Hit", Baseline: 45, GraphRAG: 58 },
  { metric: "Token Eff.", Baseline: 90, GraphRAG: 40 },
  { metric: "Cost Eff.", Baseline: 85, GraphRAG: 35 },
];

export function Benchmark() {
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState(50);
  const [data] = useState(DEMO_AGGREGATE);

  const typeData = data.byType.map((t) => ({
    name: t.type.charAt(0).toUpperCase() + t.type.slice(1),
    Baseline: +(t.baselineF1 * 100).toFixed(1),
    GraphRAG: +(t.graphragF1 * 100).toFixed(1),
  }));

  return (
    <div>
      {/* Controls */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="display-sm mb-2">Batch Benchmark</div>
            <p className="body-sm" style={{ color: "#6c6a64" }}>
              Run both pipelines on HotpotQA multi-hop questions
            </p>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <label className="caption">
              Samples
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={samples}
                onChange={(e) => setSamples(+e.target.value)}
                className="block w-32 mt-1 accent-[#FF6B00]"
              />
              <span className="body-sm font-mono">{samples}</span>
            </label>
            <button className="btn btn-primary" onClick={() => setRunning(true)} disabled={running}>
              {running ? "Running…" : "🏃 Run Benchmark"}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Avg F1 (Baseline)", value: data.baseline.avgF1.toFixed(4), color: "#0072CE" },
          { label: "Avg F1 (GraphRAG)", value: data.graphrag.avgF1.toFixed(4), color: "#FF6B00" },
          { label: "GraphRAG Win Rate", value: (data.f1WinRate * 100).toFixed(0) + "%", color: "#5db872" },
          { label: "Samples Evaluated", value: data.numSamples.toString(), color: "#002B49" },
        ].map((m, i) => (
          <div key={i} className="card-cream text-center" style={{ padding: "20px" }}>
            <div className="metric-value-sm" style={{ color: m.color }}>{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radar Chart */}
        <div className="card">
          <div className="title-md mb-4">Multi-Metric Radar</div>
          <ResponsiveContainer width="100%" height={340}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#002B49" strokeOpacity={0.12} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#6c6a64", fontSize: 12 }} />
              <Radar name="Baseline" dataKey="Baseline" stroke="#0072CE" fill="#0072CE" fillOpacity={0.15} strokeWidth={2} />
              <Radar name="GraphRAG" dataKey="GraphRAG" stroke="#FF6B00" fill="#FF6B00" fillOpacity={0.15} strokeWidth={2} />
              <Legend />
              <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "8px" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* By Question Type */}
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
      </div>

      {/* Detailed Table */}
      <div className="card">
        <div className="title-md mb-4">Detailed Comparison</div>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-hairline)" }}>
                {["Metric", "Baseline RAG", "GraphRAG", "Winner"].map((h) => (
                  <th key={h} className="caption-uppercase text-left" style={{ padding: "12px 16px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { metric: "Avg F1 Score", b: data.baseline.avgF1.toFixed(4), g: data.graphrag.avgF1.toFixed(4), winner: "graphrag" },
                { metric: "Avg Exact Match", b: data.baseline.avgEM.toFixed(4), g: data.graphrag.avgEM.toFixed(4), winner: "graphrag" },
                { metric: "Avg Context Hit", b: data.baseline.avgContextHit.toFixed(4), g: data.graphrag.avgContextHit.toFixed(4), winner: "graphrag" },
                { metric: "Avg Tokens/Query", b: data.baseline.avgTokens.toFixed(0), g: data.graphrag.avgTokens.toFixed(0), winner: "baseline" },
                { metric: "Avg Cost ($)", b: "$" + data.baseline.avgCost.toFixed(6), g: "$" + data.graphrag.avgCost.toFixed(6), winner: "baseline" },
                { metric: "Avg Latency (ms)", b: data.baseline.avgLatency.toFixed(0), g: data.graphrag.avgLatency.toFixed(0), winner: "baseline" },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--color-hairline-soft)" }}>
                  <td className="title-sm" style={{ padding: "12px 16px" }}>{row.metric}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "#0072CE" }}>{row.b}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "#FF6B00" }}>{row.g}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className={row.winner === "graphrag" ? "badge-orange" : "badge-blue"} style={{ fontSize: "0.6875rem" }}>
                      {row.winner === "graphrag" ? "GraphRAG" : "Baseline"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
