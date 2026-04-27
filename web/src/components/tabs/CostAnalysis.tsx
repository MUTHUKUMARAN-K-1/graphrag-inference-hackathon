"use client";

import { useState, useMemo } from "react";
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from "recharts";

const MODELS = [
  { id: "claude-sonnet", label: "Claude Sonnet 4", inputPer1k: 0.003, outputPer1k: 0.015 },
  { id: "claude-haiku", label: "Claude Haiku 4", inputPer1k: 0.00025, outputPer1k: 0.00125 },
  { id: "gpt-4o-mini", label: "GPT-4o-mini", inputPer1k: 0.00015, outputPer1k: 0.0006 },
  { id: "gpt-4o", label: "GPT-4o", inputPer1k: 0.0025, outputPer1k: 0.01 },
];

export function CostAnalysis() {
  const [numQueries, setNumQueries] = useState(10000);
  const [modelIdx, setModelIdx] = useState(0);
  const model = MODELS[modelIdx];

  const baselineAvgTokens = 950;
  const graphragAvgTokens = 2400;
  const baselineCostPerQ = (800 / 1000) * model.inputPer1k + (150 / 1000) * model.outputPer1k;
  const graphragCostPerQ = (2200 / 1000) * model.inputPer1k + (200 / 1000) * model.outputPer1k;

  const cumulativeData = useMemo(() => {
    const points: { queries: number; Baseline: number; GraphRAG: number }[] = [];
    const step = Math.max(Math.floor(numQueries / 50), 1);
    for (let q = 0; q <= numQueries; q += step) {
      points.push({
        queries: q,
        Baseline: +(baselineCostPerQ * q).toFixed(4),
        GraphRAG: +(graphragCostPerQ * q).toFixed(4),
      });
    }
    return points;
  }, [numQueries, baselineCostPerQ, graphragCostPerQ]);

  return (
    <div>
      {/* Controls */}
      <div className="card mb-6">
        <div className="display-sm mb-4">Cost &amp; Token Projections</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="caption">Number of Queries</label>
            <input type="range" min={100} max={100000} step={100}
              value={numQueries} onChange={(e) => setNumQueries(+e.target.value)}
              className="w-full mt-2 accent-[#FF6B00]" />
            <div className="body-sm font-mono mt-1">{numQueries.toLocaleString()}</div>
          </div>
          <div>
            <label className="caption">LLM Model</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {MODELS.map((m, i) => (
                <button key={m.id}
                  className={i === modelIdx ? "badge-orange" : "badge-outline cursor-pointer"}
                  onClick={() => setModelIdx(i)} style={{ fontSize: "0.75rem" }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="caption">Token Ratio</label>
            <div className="metric-value-sm mt-2" style={{ color: "#cc785c" }}>
              {(graphragAvgTokens / baselineAvgTokens).toFixed(1)}x
            </div>
            <div className="metric-label">GraphRAG / Baseline</div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Cost/Query (Baseline)", value: "$" + baselineCostPerQ.toFixed(6), color: "#0072CE" },
          { label: "Cost/Query (GraphRAG)", value: "$" + graphragCostPerQ.toFixed(6), color: "#FF6B00" },
          { label: `Total (${(numQueries / 1000).toFixed(0)}K)`, value: "$" + (baselineCostPerQ * numQueries).toFixed(2), color: "#0072CE" },
          { label: `Total (${(numQueries / 1000).toFixed(0)}K)`, value: "$" + (graphragCostPerQ * numQueries).toFixed(2), color: "#FF6B00" },
          { label: "Annual (1K qpd)", value: "$" + (graphragCostPerQ * 1000 * 365).toFixed(0), color: "#cc785c" },
        ].map((m, i) => (
          <div key={i} className="card-cream" style={{ padding: "16px", textAlign: "center" }}>
            <div className="metric-value-sm" style={{ color: m.color, fontSize: "1.125rem" }}>{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Cumulative Cost Chart */}
      <div className="card mb-6">
        <div className="title-md mb-4">Cumulative Cost — {model.label}</div>
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={cumulativeData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0072CE" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#0072CE" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="graphragGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#002B49" strokeOpacity={0.06} />
            <XAxis dataKey="queries" tick={{ fill: "#6c6a64", fontSize: 11 }}
              tickFormatter={(v) => (Number(v) >= 1000 ? `${Number(v) / 1000}K` : String(v))} />
            <YAxis tick={{ fill: "#6c6a64", fontSize: 11 }}
              tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "8px" }} />
            <Legend />
            <Area type="monotone" dataKey="Baseline" stroke="#0072CE" strokeWidth={2.5} fill="url(#baselineGrad)" />
            <Area type="monotone" dataKey="GraphRAG" stroke="#FF6B00" strokeWidth={2.5} fill="url(#graphragGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Insight Card */}
      <div className="card-coral">
        <div className="display-sm" style={{ color: "white" }}>💡 Key Insight</div>
        <p className="body-md mt-3" style={{ color: "rgba(255,255,255,0.9)", maxWidth: "640px" }}>
          GraphRAG uses <strong>{(graphragAvgTokens / baselineAvgTokens).toFixed(1)}×</strong> more
          tokens per query, but delivers <strong>+13% higher F1</strong> on complex multi-hop questions.
          The Adaptive Router eliminates this overhead for simple queries by routing them to Baseline RAG —
          achieving the best of both worlds.
        </p>
        <button className="btn btn-on-dark mt-4"
          onClick={() => document.getElementById("live")?.scrollIntoView({ behavior: "smooth" })}>
          Try Adaptive Routing →
        </button>
      </div>
    </div>
  );
}
