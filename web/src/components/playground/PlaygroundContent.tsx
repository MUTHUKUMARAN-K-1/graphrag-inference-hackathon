"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";

interface PipelineResult {
  answer: string;
  tokens: number;
  latencyMs: number;
  costUsd: number;
  entities?: string[];
  relations?: string[];
}

interface ProviderInfo {
  id: string;
  name: string;
  isLocal: boolean;
  hasApiKey: boolean;
  defaultModel: string;
  models: { id: string; name: string; speed: string; quality: string }[];
}

const EXAMPLES = [
  { q: "What theory describes gravity as the curvature of spacetime caused by mass and energy?", type: "Factoid" },
  { q: "What biological process converts sunlight and CO₂ into glucose in plants?", type: "Factoid" },
  { q: "What molecule stores and transmits genetic information in all living cells?", type: "Factoid" },
  { q: "What field of physics describes matter behavior at the subatomic scale using wave functions?", type: "Factoid" },
  { q: "Which chemical element with atomic number 6 forms the backbone of all organic molecules?", type: "Factoid" },
];

const FALLBACK_PROVIDERS: ProviderInfo[] = [
  { id: "openai", name: "OpenAI / BotLearn", isLocal: false, hasApiKey: false, defaultModel: "gpt-4o-mini", models: [{ id: "gpt-4o-mini", name: "GPT-4o Mini", speed: "fast", quality: "medium" }] },
  { id: "anthropic", name: "Anthropic Claude", isLocal: false, hasApiKey: false, defaultModel: "claude-sonnet-4-20250514", models: [{ id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", speed: "medium", quality: "high" }] },
  { id: "gemini", name: "Google Gemini", isLocal: false, hasApiKey: false, defaultModel: "gemini-2.0-flash", models: [{ id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", speed: "fast", quality: "medium" }] },
  { id: "groq", name: "Groq", isLocal: false, hasApiKey: false, defaultModel: "llama-3.3-70b-versatile", models: [{ id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", speed: "fast", quality: "high" }] },
  { id: "mistral", name: "Mistral AI", isLocal: false, hasApiKey: false, defaultModel: "mistral-large-latest", models: [{ id: "mistral-large-latest", name: "Mistral Large", speed: "medium", quality: "high" }] },
  { id: "deepseek", name: "DeepSeek", isLocal: false, hasApiKey: false, defaultModel: "deepseek-chat", models: [{ id: "deepseek-chat", name: "DeepSeek V3", speed: "fast", quality: "high" }] },
];

const PIPE_COLORS = {
  llmOnly:  "#6c6a64",
  baseline: "#0072CE",
  graphrag: "#FF6B00",
};

export function PlaygroundContent() {
  const [providers, setProviders] = useState<ProviderInfo[]>(FALLBACK_PROVIDERS);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [adaptiveRouting, setAdaptiveRouting] = useState(true);
  const [llmOnly, setLlmOnly] = useState<PipelineResult | null>(null);
  const [baseline, setBaseline] = useState<PipelineResult | null>(null);
  const [graphrag, setGraphrag] = useState<PipelineResult | null>(null);
  const [complexity, setComplexity] = useState(0);
  const [queryType, setQueryType] = useState("");
  const [recommended, setRecommended] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    fetch("/api/providers").then(r => r.json()).then(d => {
      if (d.providers) setProviders(d.providers);
    }).catch(() => {});
  }, []);

  const selectedProvider = providers.find(p => p.id === provider) || providers[0];
  const selectedModel = model || selectedProvider?.defaultModel || "";

  const runComparison = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, adaptiveRouting, provider, model: selectedModel }),
      });
      const data = await res.json();
      setLlmOnly(data.llmOnly ?? null);
      setBaseline(data.baseline ?? null);
      setGraphrag(data.graphrag ?? null);
      setComplexity(data.complexity ?? 0);
      setQueryType(data.queryType ?? "");
      setRecommended(data.recommended ?? "");
      setDemoMode(data.demoMode ?? false);
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  const chartData = llmOnly && baseline && graphrag ? [
    {
      name: "Tokens",
      "LLM-Only": llmOnly.tokens,
      "Basic RAG": baseline.tokens,
      "GraphRAG": graphrag.tokens,
    },
    {
      name: "Latency (ms)",
      "LLM-Only": Math.round(llmOnly.latencyMs),
      "Basic RAG": Math.round(baseline.latencyMs),
      "GraphRAG": Math.round(graphrag.latencyMs),
    },
  ] : [];

  const tokenReduction = baseline && graphrag && baseline.tokens > 0
    ? Math.round((1 - graphrag.tokens / baseline.tokens) * 100)
    : null;

  return (
    <div>
      {/* Provider Selection */}
      <div className="card mb-6 animate-fade-in-up">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="caption mb-2 block">LLM Provider</label>
            <select className="input" value={provider} onChange={e => { setProvider(e.target.value); setModel(""); }}>
              {providers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.isLocal ? "🦙 " : "☁️ "}{p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="caption mb-2 block">Model</label>
            <select className="input" value={selectedModel} onChange={e => setModel(e.target.value)}>
              {selectedProvider?.models.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.speed}/{m.quality})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 caption cursor-pointer">
              <input type="checkbox" checked={adaptiveRouting}
                onChange={e => setAdaptiveRouting(e.target.checked)}
                className="w-4 h-4 accent-[#FF6B00] rounded" />
              🧠 Adaptive Routing
            </label>
            {!selectedProvider?.hasApiKey && !selectedProvider?.isLocal && (
              <span className="badge-outline" style={{ fontSize: "0.6875rem", alignSelf: "flex-start" }}>
                Demo Mode — No API Key
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Query Input */}
      <div className="card mb-6 animate-fade-in-up delay-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <textarea
              className="input textarea"
              placeholder="Ask a science question… e.g., What theory describes gravity as the curvature of spacetime?"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runComparison(); } }}
              rows={3}
              style={{ fontSize: "1.0625rem" }}
            />
          </div>
          <div className="lg:w-56 flex flex-col gap-3 justify-end">
            <button className="btn btn-primary btn-lg w-full" onClick={runComparison}
              disabled={loading || !query.trim()}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Running…
                </span>
              ) : (
                <>▶ Run All 3 Pipelines</>
              )}
            </button>
          </div>
        </div>

        {/* Example Questions */}
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--color-hairline-soft)" }}>
          <span className="caption mr-3">Try these:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {EXAMPLES.map((ex, i) => (
              <button key={i} className="badge-outline cursor-pointer hover:bg-surface-soft transition-all"
                style={{ fontSize: "0.75rem", padding: "6px 12px" }}
                onClick={() => setQuery(ex.q)}>
                <span style={{ color: "var(--color-tiger-orange)", marginRight: "4px" }}>{ex.type}</span>
                {ex.q.slice(0, 48)}…
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {demoMode && baseline && (
        <div className="card-cream mb-6 flex items-center gap-3 animate-fade-in" style={{ padding: "14px 20px" }}>
          <span style={{ fontSize: "1.25rem" }}>ℹ️</span>
          <span className="body-sm">
            <strong>Demo Mode</strong> — Showing sample data. Set your API key in <code>web/.env</code> for live results.
          </span>
        </div>
      )}

      {/* Adaptive Routing Info */}
      {recommended && !demoMode && (
        <div className="card mb-6 animate-fade-in" style={{
          padding: "14px 24px",
          borderLeft: `4px solid ${recommended === "graphrag" ? "#FF6B00" : "#0072CE"}`,
        }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="badge-glow" style={{ fontSize: "0.6875rem" }}>🧠 Adaptive Router</span>
            <span className="body-sm">
              Complexity: <strong style={{ fontFamily: "var(--font-mono)" }}>{complexity.toFixed(2)}</strong>
              <span style={{ color: "var(--color-muted)", margin: "0 8px" }}>·</span>
              Type: <strong>{queryType}</strong>
              <span style={{ color: "var(--color-muted)", margin: "0 8px" }}>·</span>
              Recommended: <strong style={{ color: recommended === "graphrag" ? "#FF6B00" : "#0072CE" }}>
                {recommended === "graphrag" ? "GraphRAG" : "Basic RAG"}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Token Reduction Badge */}
      {tokenReduction !== null && tokenReduction > 0 && (
        <div className="mb-6 flex items-center justify-center animate-fade-in">
          <div className="badge-glow" style={{ fontSize: "0.875rem", padding: "8px 20px" }}>
            🏆 GraphRAG used <strong>−{tokenReduction}% tokens</strong> vs Basic RAG
          </div>
        </div>
      )}

      {/* 3-Pipeline Results */}
      {llmOnly && baseline && graphrag && (
        <div className="animate-fade-in-up">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

            {/* Pipeline 1: LLM-Only */}
            <div className="card" style={{ position: "relative", borderTop: `3px solid ${PIPE_COLORS.llmOnly}` }}>
              <div style={{
                position: "absolute", top: "16px", right: "16px",
                width: "8px", height: "8px", borderRadius: "50%",
                background: PIPE_COLORS.llmOnly,
              }} />
              <div className="caption-uppercase mb-1" style={{ color: PIPE_COLORS.llmOnly }}>Pipeline 1</div>
              <div className="title-lg mb-4">LLM-Only</div>
              <p className="body-sm mb-4" style={{ color: "var(--color-muted)", fontStyle: "italic" }}>
                No retrieval — pure parametric knowledge
              </p>
              <div className="body-md mb-6" style={{ minHeight: "80px", lineHeight: 1.65 }}>
                {llmOnly.answer}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                <div>
                  <div className="metric-value-sm" style={{ color: PIPE_COLORS.llmOnly }}>{llmOnly.tokens.toLocaleString()}</div>
                  <div className="metric-label">Tokens</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: PIPE_COLORS.llmOnly }}>{llmOnly.latencyMs.toFixed(0)}ms</div>
                  <div className="metric-label">Latency</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: PIPE_COLORS.llmOnly }}>${llmOnly.costUsd.toFixed(6)}</div>
                  <div className="metric-label">Cost</div>
                </div>
              </div>
            </div>

            {/* Pipeline 2: Basic RAG */}
            <div className="card" style={{ position: "relative", borderTop: `3px solid ${PIPE_COLORS.baseline}` }}>
              <div style={{
                position: "absolute", top: "16px", right: "16px",
                width: "8px", height: "8px", borderRadius: "50%",
                background: PIPE_COLORS.baseline,
                boxShadow: "0 0 8px rgba(0,114,206,0.4)",
              }} />
              <div className="caption-uppercase mb-1" style={{ color: PIPE_COLORS.baseline }}>Pipeline 2</div>
              <div className="title-lg mb-4">Basic RAG</div>
              <p className="body-sm mb-4" style={{ color: "var(--color-muted)", fontStyle: "italic" }}>
                Vector search → full chunk text → LLM
              </p>
              <div className="body-md mb-6" style={{ minHeight: "80px", lineHeight: 1.65 }}>
                {baseline.answer}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                <div>
                  <div className="metric-value-sm" style={{ color: PIPE_COLORS.baseline }}>{baseline.tokens.toLocaleString()}</div>
                  <div className="metric-label">Tokens</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: PIPE_COLORS.baseline }}>{baseline.latencyMs.toFixed(0)}ms</div>
                  <div className="metric-label">Latency</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: PIPE_COLORS.baseline }}>${baseline.costUsd.toFixed(6)}</div>
                  <div className="metric-label">Cost</div>
                </div>
              </div>
            </div>

            {/* Pipeline 3: GraphRAG */}
            <div className="card" style={{ position: "relative", borderTop: `3px solid ${PIPE_COLORS.graphrag}` }}>
              <div style={{
                position: "absolute", top: "16px", right: "16px",
                width: "8px", height: "8px", borderRadius: "50%",
                background: PIPE_COLORS.graphrag,
                boxShadow: "0 0 8px rgba(255,107,0,0.4)",
              }} />
              <div className="caption-uppercase mb-1" style={{ color: PIPE_COLORS.graphrag }}>Pipeline 3</div>
              <div className="title-lg mb-4">GraphRAG</div>
              <p className="body-sm mb-4" style={{ color: "var(--color-muted)", fontStyle: "italic" }}>
                TigerGraph → compact entity context → LLM
              </p>
              <div className="body-md mb-6" style={{ minHeight: "80px", lineHeight: 1.65 }}>
                {graphrag.answer}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                <div>
                  <div className="metric-value-sm" style={{ color: PIPE_COLORS.graphrag }}>{graphrag.tokens.toLocaleString()}</div>
                  <div className="metric-label">Tokens</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: PIPE_COLORS.graphrag }}>{graphrag.latencyMs.toFixed(0)}ms</div>
                  <div className="metric-label">Latency</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: PIPE_COLORS.graphrag }}>${graphrag.costUsd.toFixed(6)}</div>
                  <div className="metric-label">Cost</div>
                </div>
              </div>

              {/* Entities */}
              {graphrag.entities && graphrag.entities.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                  <div className="caption mb-2">Graph Entities Retrieved</div>
                  <div className="flex flex-wrap gap-1.5">
                    {graphrag.entities.map((e, i) => (
                      <span key={i} className="badge-outline" style={{ fontSize: "0.6875rem" }}>{e}</span>
                    ))}
                  </div>
                  {graphrag.relations && graphrag.relations.length > 0 && (
                    <div className="mt-3">
                      <div className="caption mb-1">Reasoning Path</div>
                      {graphrag.relations.map((r, i) => (
                        <div key={i} className="body-sm" style={{
                          color: "var(--color-muted)", fontFamily: "var(--font-mono)",
                          fontSize: "0.75rem", padding: "2px 0",
                        }}>
                          🔗 {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3-Pipeline Comparison Chart */}
          {chartData.length > 0 && (
            <div className="card">
              <div className="title-md mb-6">Side-by-Side Metrics — All 3 Pipelines</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#002B49" strokeOpacity={0.06} />
                  <XAxis dataKey="name" tick={{ fill: "#6c6a64", fontSize: 13 }} />
                  <YAxis tick={{ fill: "#6c6a64", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "10px" }} />
                  <Legend />
                  <Bar dataKey="LLM-Only" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={PIPE_COLORS.llmOnly} />)}
                  </Bar>
                  <Bar dataKey="Basic RAG" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={PIPE_COLORS.baseline} />)}
                  </Bar>
                  <Bar dataKey="GraphRAG" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={PIPE_COLORS.graphrag} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
