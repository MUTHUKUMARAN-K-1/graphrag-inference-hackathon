"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface PipelineResult {
  answer: string;
  tokens: number;
  latencyMs: number;
  costUsd: number;
  entities: string[];
  relations: string[];
}

interface ComparisonState {
  loading: boolean;
  query: string;
  baseline: PipelineResult | null;
  graphrag: PipelineResult | null;
  complexity: number;
  queryType: string;
  recommended: string;
}

const EXAMPLES = [
  "Were Scott Derrickson and Ed Wood of the same nationality?",
  "What government position was held by the woman who portrayed Nora Batty?",
  "Which magazine was started first, Arthur's Magazine or First for Women?",
  "Who was born first, Arthur Conan Doyle or Agatha Christie?",
  "What is the capital of the country where the Eiffel Tower is located?",
];

export function LiveCompare() {
  const [state, setState] = useState<ComparisonState>({
    loading: false,
    query: "",
    baseline: null,
    graphrag: null,
    complexity: 0,
    queryType: "",
    recommended: "",
  });

  const [adaptiveRouting, setAdaptiveRouting] = useState(true);
  const [showContexts, setShowContexts] = useState(false);

  const runComparison = async () => {
    if (!state.query.trim()) return;
    setState((s) => ({ ...s, loading: true }));

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: state.query,
          adaptiveRouting,
        }),
      });
      const data = await res.json();
      setState((s) => ({
        ...s,
        loading: false,
        baseline: data.baseline,
        graphrag: data.graphrag,
        complexity: data.complexity ?? 0,
        queryType: data.queryType ?? "",
        recommended: data.recommended ?? "",
      }));
    } catch {
      // Demo fallback with mock data
      setState((s) => ({
        ...s,
        loading: false,
        baseline: {
          answer: "Based on the context, both Scott Derrickson and Ed Wood were American, so yes, they shared the same nationality.",
          tokens: 847,
          latencyMs: 1240,
          costUsd: 0.000203,
          entities: [],
          relations: [],
        },
        graphrag: {
          answer: "Yes. Scott Derrickson (born in Denver, Colorado, USA) and Ed Wood (born in Poughkeepsie, New York, USA) were both American. Following the NATIONALITY relationships in the knowledge graph confirms they share the same nationality.",
          tokens: 2134,
          latencyMs: 3820,
          costUsd: 0.000518,
          entities: ["Scott Derrickson", "Ed Wood", "United States", "Denver", "Poughkeepsie"],
          relations: [
            "Scott Derrickson -[BORN_IN]-> Denver, Colorado",
            "Denver -[LOCATED_IN]-> United States",
            "Ed Wood -[BORN_IN]-> Poughkeepsie, New York",
            "Poughkeepsie -[LOCATED_IN]-> United States",
          ],
        },
        complexity: 0.72,
        queryType: "comparison",
        recommended: "graphrag",
      }));
    }
  };

  const chartData = state.baseline && state.graphrag ? [
    { name: "Tokens", Baseline: state.baseline.tokens, GraphRAG: state.graphrag.tokens },
    { name: "Latency (ms)", Baseline: state.baseline.latencyMs, GraphRAG: state.graphrag.latencyMs },
  ] : [];

  return (
    <div>
      {/* Query Input */}
      <div className="card mb-6">
        <div className="display-sm mb-4">Ask a question</div>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <textarea
              className="input textarea"
              placeholder="e.g., Were Scott Derrickson and Ed Wood of the same nationality?"
              value={state.query}
              onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runComparison(); } }}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-3 lg:w-48">
            <label className="flex items-center gap-2 cursor-pointer caption">
              <input
                type="checkbox"
                checked={adaptiveRouting}
                onChange={(e) => setAdaptiveRouting(e.target.checked)}
                className="w-4 h-4 accent-[#FF6B00]"
              />
              🧠 Adaptive Routing
            </label>
            <button
              className="btn btn-primary btn-lg w-full"
              onClick={runComparison}
              disabled={state.loading || !state.query.trim()}
            >
              {state.loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Running…
                </span>
              ) : (
                "▶ Compare"
              )}
            </button>
          </div>
        </div>

        {/* Example queries */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="caption">Try:</span>
          {EXAMPLES.slice(0, 3).map((q, i) => (
            <button
              key={i}
              className="badge-outline cursor-pointer hover:bg-surface-soft transition-colors"
              style={{ fontSize: "0.75rem" }}
              onClick={() => setState((s) => ({ ...s, query: q }))}
            >
              {q.slice(0, 50)}…
            </button>
          ))}
        </div>
      </div>

      {/* Adaptive Routing Badge */}
      {state.recommended && (
        <div className="card-cream mb-6 flex items-center gap-4 flex-wrap">
          <span className="badge-orange">🧠 Adaptive Router</span>
          <span className="body-sm">
            Complexity: <strong>{state.complexity.toFixed(2)}</strong> · Type:{" "}
            <strong>{state.queryType}</strong> · Recommended:{" "}
            <strong style={{ color: state.recommended === "graphrag" ? "#FF6B00" : "#0072CE" }}>
              {state.recommended === "graphrag" ? "GraphRAG" : "Baseline RAG"}
            </strong>
          </span>
        </div>
      )}

      {/* Results */}
      {state.baseline && state.graphrag && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Baseline Card */}
            <div className="card pipeline-baseline">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ background: "#0072CE" }} />
                <span className="title-md">Baseline RAG</span>
                <span className="badge-blue ml-auto">Pipeline A</span>
              </div>
              <p className="body-md mb-4" style={{ minHeight: "80px" }}>
                {state.baseline.answer}
              </p>
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                <div>
                  <div className="metric-value-sm" style={{ color: "#0072CE", fontFamily: "var(--font-mono)" }}>
                    {state.baseline.tokens.toLocaleString()}
                  </div>
                  <div className="metric-label">Tokens</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: "#0072CE", fontFamily: "var(--font-mono)" }}>
                    {state.baseline.latencyMs.toFixed(0)}ms
                  </div>
                  <div className="metric-label">Latency</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: "#0072CE", fontFamily: "var(--font-mono)" }}>
                    ${state.baseline.costUsd.toFixed(6)}
                  </div>
                  <div className="metric-label">Cost</div>
                </div>
              </div>
            </div>

            {/* GraphRAG Card */}
            <div className="card pipeline-graphrag">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ background: "#FF6B00" }} />
                <span className="title-md">GraphRAG</span>
                <span className="badge-orange ml-auto">Pipeline B</span>
              </div>
              <p className="body-md mb-4" style={{ minHeight: "80px" }}>
                {state.graphrag.answer}
              </p>
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                <div>
                  <div className="metric-value-sm" style={{ color: "#FF6B00", fontFamily: "var(--font-mono)" }}>
                    {state.graphrag.tokens.toLocaleString()}
                  </div>
                  <div className="metric-label">Tokens</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: "#FF6B00", fontFamily: "var(--font-mono)" }}>
                    {state.graphrag.latencyMs.toFixed(0)}ms
                  </div>
                  <div className="metric-label">Latency</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: "#FF6B00", fontFamily: "var(--font-mono)" }}>
                    ${state.graphrag.costUsd.toFixed(6)}
                  </div>
                  <div className="metric-label">Cost</div>
                </div>
              </div>

              {/* Entities & Relations */}
              {state.graphrag.entities.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                  <div className="caption mb-2">Entities Found:</div>
                  <div className="flex flex-wrap gap-1">
                    {state.graphrag.entities.map((e, i) => (
                      <span key={i} className="badge-outline" style={{ fontSize: "0.6875rem" }}>{e}</span>
                    ))}
                  </div>
                  {state.graphrag.relations.length > 0 && (
                    <div className="mt-3">
                      <div className="caption mb-1">Reasoning Path:</div>
                      {state.graphrag.relations.map((r, i) => (
                        <div key={i} className="body-sm" style={{ color: "#6c6a64", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                          🔗 {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Comparison Chart */}
          <div className="card">
            <div className="title-md mb-4">Metrics Comparison</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#002B49" strokeOpacity={0.08} />
                <XAxis dataKey="name" tick={{ fill: "#6c6a64", fontSize: 13 }} />
                <YAxis tick={{ fill: "#6c6a64", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#faf9f5",
                    border: "1px solid #e6dfd8",
                    borderRadius: "8px",
                    fontFamily: "var(--font-sans)",
                  }}
                />
                <Legend />
                <Bar dataKey="Baseline" fill="#0072CE" radius={[4, 4, 0, 0]} />
                <Bar dataKey="GraphRAG" fill="#FF6B00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
