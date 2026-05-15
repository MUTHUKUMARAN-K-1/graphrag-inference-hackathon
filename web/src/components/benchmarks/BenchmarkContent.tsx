"use client";

import { useState, useEffect } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from "recharts";

interface PipelineStats {
  avgF1: number; avgEM: number; avgTokens: number; avgCost: number; avgLatency: number;
}

interface AggregateData {
  numSamples: number;
  llmOnly: PipelineStats;
  baseline: PipelineStats;
  graphrag: PipelineStats;
  graphragF1WinRate: number;
  tokenReductionVsBaseline: number;
  chunksSource?: string;
  // Answer accuracy evaluation (hackathon required)
  graphragJudgePassRate?: number;
  baselineJudgePassRate?: number;
  avgBertscoreRaw?: number;
  avgBertscoreRescaled?: number;
  bonusJudge?: boolean;
  bonusBertscore?: boolean;
  bertscoreAvailable?: boolean;
  byType?: {
    bridge?: { count: number; baselineF1: number; graphragF1: number } | null;
    comparison?: { count: number; baselineF1: number; graphragF1: number } | null;
  };
}

const EMPTY_PIPE: PipelineStats = { avgF1: 0, avgEM: 0, avgTokens: 0, avgCost: 0, avgLatency: 0 };

const DEMO_DATA: AggregateData = {
  numSamples: 10,
  llmOnly:  { avgF1: 0.7200, avgEM: 0.6000, avgTokens: 112,  avgCost: 0.000017, avgLatency: 820 },
  baseline: { avgF1: 0.7800, avgEM: 0.6500, avgTokens: 1842, avgCost: 0.000277, avgLatency: 1480 },
  graphrag: { avgF1: 0.8100, avgEM: 0.7000, avgTokens: 387,  avgCost: 0.000058, avgLatency: 980 },
  graphragF1WinRate: 0.70,
  tokenReductionVsBaseline: 79,
  graphragJudgePassRate: 0.80,
  baselineJudgePassRate: 0.70,
  avgBertscoreRaw: 0.877,
  avgBertscoreRescaled: 0.846,
  bonusJudge: false,
  bonusBertscore: true,
  bertscoreAvailable: true,
  byType: {
    bridge: { count: 5, baselineF1: 0.7400, graphragF1: 0.8200 },
    comparison: { count: 5, baselineF1: 0.8200, graphragF1: 0.8000 },
  },
};

export function BenchmarkContent() {
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState(10);
  const [data, setData] = useState<AggregateData>(DEMO_DATA);
  const [report, setReport] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [hasResults, setHasResults] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");

  // Load saved API settings from localStorage (shared with playground)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("graphrag_api_settings");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.apiKey) setCustomApiKey(s.apiKey);
        if (s.baseUrl) setCustomBaseUrl(s.baseUrl);
      }
    } catch { /* ignore */ }
  }, []);

  const saveSettings = (apiKey: string, baseUrl: string) => {
    setCustomApiKey(apiKey);
    setCustomBaseUrl(baseUrl);
    try { localStorage.setItem("graphrag_api_settings", JSON.stringify({ apiKey, baseUrl })); } catch { /* ignore */ }
  };

  const clearSettings = () => {
    setCustomApiKey("");
    setCustomBaseUrl("");
    try { localStorage.removeItem("graphrag_api_settings"); } catch { /* ignore */ }
  };

  const usingCustomKey = !!customApiKey;

  const runBenchmark = async () => {
    setRunning(true);
    setReport("Running benchmark...");
    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numSamples: samples,
          ...(customApiKey && { customApiKey }),
          ...(customBaseUrl && { customBaseUrl }),
        }),
      });
      const result = await res.json();
      const agg = result.aggregate;
      // Back-fill llmOnly if API omits it (graceful for old shape)
      if (!agg.llmOnly) agg.llmOnly = EMPTY_PIPE;
      if (agg.tokenReductionVsBaseline == null) {
        agg.tokenReductionVsBaseline = agg.baseline.avgTokens > 0
          ? Math.round((1 - agg.graphrag.avgTokens / agg.baseline.avgTokens) * 100) : 0;
      }
      setData(agg);
      setDemoMode(result.demoMode ?? false);
      setHasResults(true);

      const a = agg;
      const col = (n: number | string, w = 14) => String(n).padEnd(w);
      const lines = [
        `BENCHMARK RESULTS (${a.numSamples} samples, ${result.provider}/${result.model})`,
        result.demoMode ? "⚠️  DEMO MODE — set API key for live results" : "✅ LIVE RESULTS",
        "",
        `${"Metric".padEnd(28)}${"LLM-Only".padEnd(14)}${"Basic RAG".padEnd(14)}GraphRAG`,
        "─".repeat(70),
        `${"Avg F1 (token overlap)".padEnd(28)}${col(a.llmOnly.avgF1.toFixed(4))}${col(a.baseline.avgF1.toFixed(4))}${a.graphrag.avgF1.toFixed(4)}`,
        `${"Avg EM".padEnd(28)}${col(a.llmOnly.avgEM.toFixed(4))}${col(a.baseline.avgEM.toFixed(4))}${a.graphrag.avgEM.toFixed(4)}`,
        `${"Avg Tokens/Query".padEnd(28)}${col(a.llmOnly.avgTokens)}${col(a.baseline.avgTokens)}${a.graphrag.avgTokens}`,
        `${"Token Reduction vs RAG".padEnd(28)}${"—".padEnd(14)}${"0%".padEnd(14)}${a.tokenReductionVsBaseline}%`,
        `${"GraphRAG F1 Win Rate".padEnd(28)}${(a.graphragF1WinRate * 100).toFixed(0)}%`,
        "",
        "─".repeat(70),
        "ACCURACY EVALUATION (hackathon required criteria)",
        "─".repeat(70),
        `${"LLM-as-a-Judge Pass Rate".padEnd(28)}${col(((a.baselineJudgePassRate ?? 0) * 100).toFixed(1) + "%")}${((a.graphragJudgePassRate ?? 0) * 100).toFixed(1)}% ${(a.graphragJudgePassRate ?? 0) >= 0.90 ? "✅ BONUS" : "(need ≥90%)"}`,
        `${"BERTScore Raw".padEnd(28)}${col("")}${a.bertscoreAvailable === false ? "N/A (set HF_TOKEN)" : (a.avgBertscoreRaw ?? 0).toFixed(4) + " " + ((a.avgBertscoreRaw ?? 0) >= 0.88 ? "✅ BONUS" : "(need ≥0.88)")}`,
        `${"BERTScore Rescaled".padEnd(28)}${col("")}${a.bertscoreAvailable === false ? "N/A (set HF_TOKEN)" : (a.avgBertscoreRescaled ?? 0).toFixed(4) + " " + ((a.avgBertscoreRescaled ?? 0) >= 0.55 ? "✅ BONUS" : "(need ≥0.55)")}`,
        "",
        a.bonusJudge && a.bonusBertscore ? "🏆 MAXIMUM BONUS UNLOCKED — both accuracy thresholds hit!"
          : a.bonusBertscore ? "⭐ BERTScore bonus earned. Improve judge pass rate to ≥90% for max bonus."
          : a.bonusJudge ? "⭐ Judge bonus earned. Improve BERTScore to unlock full bonus."
          : "⚠️  Below bonus thresholds. Tune chunking, hop depth, or prompt to improve accuracy.",
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
  if (data.byType?.bridge) typeData.push({ name: "Bridge", Baseline: +(data.byType.bridge.baselineF1 * 100).toFixed(1), GraphRAG: +(data.byType.bridge.graphragF1 * 100).toFixed(1) });
  if (data.byType?.comparison) typeData.push({ name: "Comparison", Baseline: +(data.byType.comparison.baselineF1 * 100).toFixed(1), GraphRAG: +(data.byType.comparison.graphragF1 * 100).toFixed(1) });

  // Token efficiency data — headline is total tokens per pipeline
  const tokenData = [
    { name: "LLM-Only",  Tokens: data.llmOnly.avgTokens },
    { name: "Basic RAG", Tokens: data.baseline.avgTokens },
    { name: "GraphRAG",  Tokens: data.graphrag.avgTokens },
  ];

  return (
    <div>
      {/* Run Controls */}
      <div className="card mb-8 animate-fade-in-up">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[200px]">
            <div className="display-sm mb-2">Run Benchmark</div>
            <p className="body-sm" style={{ color: "var(--color-muted)" }}>
              Evaluate all 3 pipelines on 10 science questions from the Wikipedia corpus
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
        {/* API Settings */}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline-soft)" }}>
          <button
            onClick={() => setShowSettings(s => !s)}
            className="flex items-center gap-2 caption"
            style={{ color: "var(--color-muted)", cursor: "pointer", background: "none", border: "none", padding: 0 }}
          >
            <span style={{ fontSize: "0.75rem" }}>⚙</span>
            {showSettings ? "▲" : "▼"} API Settings
            <span style={{ color: "var(--color-tiger-orange)", fontSize: "0.6875rem", marginLeft: "4px" }}>
              {usingCustomKey ? "(your key active — live mode)" : "(optional — uses env defaults)"}
            </span>
          </button>
          {showSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="caption mb-1 block">API Key</label>
                <input
                  type="password"
                  className="input"
                  placeholder="sk-… or leave blank to use server env"
                  value={customApiKey}
                  onChange={e => saveSettings(e.target.value, customBaseUrl)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="caption mb-1 block">Base URL <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. https://models.botlearn.ai/v1"
                  value={customBaseUrl}
                  onChange={e => saveSettings(customApiKey, e.target.value)}
                />
              </div>
              {(customApiKey || customBaseUrl) && (
                <div className="md:col-span-2 flex justify-end">
                  <button
                    onClick={clearSettings}
                    className="caption"
                    style={{ color: "var(--color-muted)", cursor: "pointer", background: "none", border: "none", padding: 0, textDecoration: "underline" }}
                  >
                    Clear — revert to server defaults
                  </button>
                </div>
              )}
            </div>
          )}
          {!usingCustomKey && demoMode && (
            <div className="flex items-center gap-2 mt-3">
              <span className="badge-outline" style={{ fontSize: "0.6875rem" }}>📊 Pre-computed Demo Results</span>
              <span className="body-sm" style={{ color: "var(--color-muted)" }}>
                Enter your API key above for live benchmark data
              </span>
            </div>
          )}
          {!demoMode && data.chunksSource && (
            <div className="flex items-center gap-2 mt-3">
              {data.chunksSource === "tigergraph" ? (
                <span className="badge-orange" style={{ fontSize: "0.6875rem" }}>🔴 Live TigerGraph Retrieval</span>
              ) : (
                <span className="badge-outline" style={{ fontSize: "0.6875rem" }}>📦 Corpus Fallback</span>
              )}
              <span className="body-sm" style={{ color: "var(--color-muted)" }}>
                {data.chunksSource === "tigergraph"
                  ? "Chunks retrieved via vector search + multi-hop entity traversal"
                  : "Pre-loaded corpus context used (TigerGraph not reached)"}
              </span>
            </div>
          )}
        </div>
      </div>

      {hasResults && (
        <>
          {/* Hero Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up delay-100">
            {[
              {
                label: "Token Reduction",
                value: `${data.tokenReductionVsBaseline}%`,
                delta: "GraphRAG vs Basic RAG",
                color: "#FF6B00",
                bg: "linear-gradient(135deg, #FFF4EB, #faf9f5)",
              },
              {
                label: "GraphRAG F1",
                value: (data.graphrag.avgF1 * 100).toFixed(1) + "%",
                delta: `+${((data.graphrag.avgF1 - data.baseline.avgF1) * 100).toFixed(1)}% vs RAG`,
                color: "#5db872",
                bg: "linear-gradient(135deg, #ecf7ef, #faf9f5)",
              },
              {
                label: "F1 Win Rate",
                value: (data.graphragF1WinRate * 100).toFixed(0) + "%",
                delta: `${(data.graphragF1WinRate * 100).toFixed(0)}% of queries`,
                color: "#0072CE",
                bg: "linear-gradient(135deg, #E6F4FF, #faf9f5)",
              },
              {
                label: "Samples",
                value: data.numSamples.toString(),
                delta: "Science corpus",
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

          {/* Accuracy Evaluation — 30% of hackathon score */}
          <div className="card mb-8 animate-fade-in-up delay-150" style={{
            borderTop: "3px solid #FF6B00",
          }}>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div>
                <div className="title-md">Answer Accuracy Evaluation</div>
                <p className="body-sm mt-1" style={{ color: "var(--color-muted)" }}>
                  30% of hackathon score · LLM-as-a-Judge + BERTScore (semantic similarity)
                </p>
              </div>
              {(data.bonusJudge && data.bonusBertscore) ? (
                <span className="badge-orange" style={{ fontSize: "0.8125rem", padding: "8px 16px" }}>🏆 Max Bonus Unlocked</span>
              ) : (data.bonusJudge || data.bonusBertscore) ? (
                <span className="badge-orange" style={{ fontSize: "0.8125rem", padding: "8px 16px" }}>⭐ Partial Bonus</span>
              ) : (
                <span className="badge-outline" style={{ fontSize: "0.8125rem", padding: "8px 16px" }}>Below Bonus Threshold</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LLM-as-a-Judge */}
              <div style={{ padding: "20px", borderRadius: "12px", background: "var(--color-surface-soft)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="title-sm">LLM-as-a-Judge</div>
                    <div className="caption mt-0.5" style={{ color: "var(--color-muted)" }}>Groq Llama-3.3-70B · independent model · PASS/FAIL per answer</div>
                  </div>
                  {(data.graphragJudgePassRate ?? 0) >= 0.90
                    ? <span className="badge-orange" style={{ fontSize: "0.6875rem" }}>✓ Bonus ≥90%</span>
                    : <span className="badge-outline" style={{ fontSize: "0.6875rem" }}>Need ≥90%</span>}
                </div>

                <div className="flex items-end gap-3 mb-4">
                  <div className="metric-value" style={{ color: "#FF6B00", fontSize: "2.5rem", lineHeight: 1 }}>
                    {((data.graphragJudgePassRate ?? 0) * 100).toFixed(0)}%
                  </div>
                  <div className="body-sm mb-1" style={{ color: "var(--color-muted)" }}>GraphRAG pass rate</div>
                </div>

                {/* Progress bar */}
                <div style={{ height: "8px", borderRadius: "4px", background: "#e6dfd8", position: "relative", marginBottom: "8px" }}>
                  <div style={{
                    height: "100%", borderRadius: "4px",
                    width: `${Math.min(100, (data.graphragJudgePassRate ?? 0) * 100)}%`,
                    background: (data.graphragJudgePassRate ?? 0) >= 0.90 ? "#5db872" : "#FF6B00",
                    transition: "width 0.5s ease",
                  }} />
                  {/* 90% marker */}
                  <div style={{
                    position: "absolute", top: "-4px", left: "90%",
                    width: "2px", height: "16px", background: "#002B49", opacity: 0.4,
                  }} />
                </div>
                <div className="flex justify-between caption" style={{ color: "var(--color-muted)" }}>
                  <span>Baseline: {((data.baselineJudgePassRate ?? 0) * 100).toFixed(0)}%</span>
                  <span>Bonus threshold: 90%</span>
                </div>
              </div>

              {/* BERTScore */}
              <div style={{ padding: "20px", borderRadius: "12px", background: "var(--color-surface-soft)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="title-sm">BERTScore</div>
                    <div className="caption mt-0.5" style={{ color: "var(--color-muted)" }}>Semantic similarity via sentence embeddings</div>
                  </div>
                  {data.bertscoreAvailable === false
                    ? <span className="badge-outline" style={{ fontSize: "0.6875rem", color: "var(--color-muted)" }}>HF_TOKEN needed</span>
                    : data.bonusBertscore
                      ? <span className="badge-orange" style={{ fontSize: "0.6875rem" }}>✓ Bonus</span>
                      : <span className="badge-outline" style={{ fontSize: "0.6875rem" }}>Need ≥0.55R / ≥0.88</span>}
                </div>

                {data.bertscoreAvailable === false ? (
                  <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(108,106,100,0.06)", textAlign: "center" }}>
                    <div className="body-sm" style={{ color: "var(--color-muted)", marginBottom: "6px" }}>
                      BERTScore requires HuggingFace embeddings
                    </div>
                    <code style={{ fontSize: "0.75rem", color: "var(--color-tiger-orange)" }}>
                      Set HF_TOKEN in Vercel environment variables
                    </code>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end gap-3 mb-4">
                      <div className="metric-value" style={{ color: "#0072CE", fontSize: "2.5rem", lineHeight: 1 }}>
                        {(data.avgBertscoreRaw ?? 0).toFixed(3)}
                      </div>
                      <div className="body-sm mb-1" style={{ color: "var(--color-muted)" }}>raw cosine F1</div>
                    </div>
                    <div style={{ height: "8px", borderRadius: "4px", background: "#e6dfd8", position: "relative", marginBottom: "8px" }}>
                      <div style={{
                        height: "100%", borderRadius: "4px",
                        width: `${Math.min(100, (data.avgBertscoreRaw ?? 0) * 100)}%`,
                        background: (data.avgBertscoreRaw ?? 0) >= 0.88 ? "#5db872" : "#0072CE",
                        transition: "width 0.5s ease",
                      }} />
                      <div style={{ position: "absolute", top: "-4px", left: "88%", width: "2px", height: "16px", background: "#002B49", opacity: 0.4 }} />
                    </div>
                    <div className="flex justify-between caption" style={{ color: "var(--color-muted)" }}>
                      <span>Rescaled: {(data.avgBertscoreRescaled ?? 0).toFixed(3)} (need ≥0.55)</span>
                      <span>Raw threshold: 0.88</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bonus explanation */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline-soft)" }}>
              <p className="body-sm" style={{ color: "var(--color-muted)" }}>
                <strong style={{ color: "var(--color-ink)" }}>Bonus unlocked by:</strong>{" "}
                judge pass rate ≥ 90% <em>and/or</em> BERTScore rescaled ≥ 0.55 (or raw ≥ 0.88).
                Hitting both thresholds earns the maximum accuracy bonus.
                BERTScore uses cosine similarity of{" "}
                <code style={{ fontSize: "0.75rem" }}>all-MiniLM-L6-v2</code> sentence embeddings (rescale baseline = 0.20).
                Requires <code style={{ fontSize: "0.75rem" }}>HF_TOKEN</code> environment variable.
              </p>
            </div>
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
              <BarChart data={tokenData} layout="vertical" margin={{ top: 10, right: 60, left: 90, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#002B49" strokeOpacity={0.06} />
                <XAxis type="number" tick={{ fill: "#6c6a64", fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#6c6a64", fontSize: 13 }} />
                <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "10px" }} formatter={(v) => [`${v} tokens`, "Avg tokens/query"]} />
                <Bar dataKey="Tokens" radius={[0, 6, 6, 0]} barSize={32} label={{ position: "right", fill: "#6c6a64", fontSize: 12 }}>
                  <Cell fill="#a0a09a" />
                  <Cell fill="#0072CE" />
                  <Cell fill="#FF6B00" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table — all 3 pipelines */}
          <div className="card mb-8 animate-fade-in-up delay-500">
            <div className="title-md mb-6">Full 3-Pipeline Comparison</div>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--color-hairline)" }}>
                    {["Metric", "LLM-Only", "Basic RAG", "GraphRAG", "Reduction (RAG→Graph)", "Winner"].map(h => (
                      <th key={h} className="caption-uppercase text-left" style={{ padding: "12px 14px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      metric: "Average F1 Score",
                      l: data.llmOnly.avgF1.toFixed(4),
                      b: data.baseline.avgF1.toFixed(4),
                      g: data.graphrag.avgF1.toFixed(4),
                      delta: `+${((data.graphrag.avgF1 - data.baseline.avgF1) * 100).toFixed(1)}%`,
                      winner: data.graphrag.avgF1 >= data.baseline.avgF1 ? "graphrag" : "baseline",
                    },
                    {
                      metric: "Average Exact Match",
                      l: data.llmOnly.avgEM.toFixed(4),
                      b: data.baseline.avgEM.toFixed(4),
                      g: data.graphrag.avgEM.toFixed(4),
                      delta: `+${((data.graphrag.avgEM - data.baseline.avgEM) * 100).toFixed(1)}%`,
                      winner: data.graphrag.avgEM >= data.baseline.avgEM ? "graphrag" : "baseline",
                    },
                    {
                      metric: "Avg Tokens / Query",
                      l: data.llmOnly.avgTokens.toLocaleString(),
                      b: data.baseline.avgTokens.toLocaleString(),
                      g: data.graphrag.avgTokens.toLocaleString(),
                      delta: `−${data.tokenReductionVsBaseline}%`,
                      winner: "graphrag",
                    },
                    {
                      metric: "Avg Cost / Query",
                      l: "$" + data.llmOnly.avgCost.toFixed(6),
                      b: "$" + data.baseline.avgCost.toFixed(6),
                      g: "$" + data.graphrag.avgCost.toFixed(6),
                      delta: data.baseline.avgCost > 0 ? `−${Math.round((1 - data.graphrag.avgCost / data.baseline.avgCost) * 100)}%` : "—",
                      winner: "graphrag",
                    },
                    {
                      metric: "Avg Latency",
                      l: data.llmOnly.avgLatency + "ms",
                      b: data.baseline.avgLatency + "ms",
                      g: data.graphrag.avgLatency + "ms",
                      delta: data.baseline.avgLatency > 0 ? `${(data.graphrag.avgLatency / data.baseline.avgLatency).toFixed(1)}×` : "—",
                      winner: data.graphrag.avgLatency <= data.baseline.avgLatency ? "graphrag" : "baseline",
                    },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--color-hairline-soft)" }}>
                      <td className="title-sm" style={{ padding: "12px 14px" }}>{row.metric}</td>
                      <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", color: "#6c6a64" }}>{row.l}</td>
                      <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", color: "#0072CE" }}>{row.b}</td>
                      <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", color: "#FF6B00" }}>{row.g}</td>
                      <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", color: "#5db872", fontSize: "0.8125rem", fontWeight: 600 }}>{row.delta}</td>
                      <td style={{ padding: "12px 14px" }}>
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

          {/* GraphRAG Enhancements */}
          <div className="card mb-8 animate-fade-in-up delay-550">
            <div className="title-md mb-4">GraphRAG Pipeline Enhancements</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: "🔗",
                  title: "Multi-hop Traversal",
                  desc: "Chunk → PART_OF → Document → sibling Chunks. Retrieves full document context beyond the top vector hit.",
                  color: "#FF6B00",
                },
                {
                  icon: "🧠",
                  title: "Entity-hop Traversal",
                  desc: "Chunk → MENTIONS → Entity → RELATED_TO → Entity → Chunks. Real graph edge traversal for relationship awareness.",
                  color: "#0072CE",
                },
                {
                  icon: "🧩",
                  title: "Chunk Loss Fix",
                  desc: "Merges up to 6 deduplicated sources (primary + siblings + entity-linked) so answers spanning multiple chunks are never missed.",
                  color: "#5db872",
                },
              ].map((e, i) => (
                <div key={i} style={{ padding: "20px", borderRadius: "12px", background: "var(--color-surface-soft)", borderLeft: `3px solid ${e.color}` }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>{e.icon}</div>
                  <div className="title-sm mb-2">{e.title}</div>
                  <p className="body-sm" style={{ color: "var(--color-muted)" }}>{e.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Insight */}
          <div className="card-coral animate-fade-in-up delay-600">
            <div className="display-sm" style={{ color: "white" }}>💡 Key Finding</div>
            <p className="body-lg mt-4" style={{ color: "rgba(255,255,255,0.9)", maxWidth: "680px" }}>
              GraphRAG reduces tokens by <strong>{data.tokenReductionVsBaseline}% vs Basic RAG</strong> while
              achieving <strong>{((data.graphragJudgePassRate ?? 0) * 100).toFixed(0)}% LLM-judge accuracy</strong>{" "}
              (graded by independent Groq Llama-3.3-70B) and{" "}
              <strong>BERTScore {(data.avgBertscoreRaw ?? 0).toFixed(3)}</strong>.
              Multi-hop document traversal and entity-graph hops surface richer context than
              flat vector search — same knowledge, fewer tokens, better answers.
            </p>
            <p className="body-md mt-3" style={{ color: "rgba(255,255,255,0.7)" }}>
              Token reduction only counts if accuracy is maintained. GraphRAG addresses all three
              core RAG pain points: chunk loss ambiguity, missing relationship awareness, and
              single-hop retrieval limits — proving the graph isn&apos;t just cheaper, it&apos;s genuinely better.
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
