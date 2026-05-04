"use client";

import { useState, useEffect } from "react";
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

interface ProviderInfo {
  id: string;
  name: string;
  isLocal: boolean;
  hasApiKey: boolean;
  defaultModel: string;
  models: { id: string; name: string; speed: string; quality: string }[];
}

const EXAMPLES = [
  { q: "Were Scott Derrickson and Ed Wood of the same nationality?", type: "Bridge" },
  { q: "What government position was held by the woman who portrayed Nora Batty?", type: "Multi-hop" },
  { q: "Which magazine was started first, Arthur's Magazine or First for Women?", type: "Comparison" },
  { q: "Who was born first, Arthur Conan Doyle or Agatha Christie?", type: "Comparison" },
  { q: "What is the capital of the country where the Eiffel Tower is located?", type: "Bridge" },
];

const FALLBACK_PROVIDERS: ProviderInfo[] = [
  { id: "anthropic", name: "Anthropic Claude", isLocal: false, hasApiKey: false, defaultModel: "claude-sonnet-4-20250514", models: [{ id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", speed: "medium", quality: "high" }] },
  { id: "openai", name: "OpenAI", isLocal: false, hasApiKey: false, defaultModel: "gpt-4o-mini", models: [{ id: "gpt-4o-mini", name: "GPT-4o Mini", speed: "fast", quality: "medium" }] },
  { id: "gemini", name: "Google Gemini", isLocal: false, hasApiKey: false, defaultModel: "gemini-2.0-flash", models: [{ id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", speed: "fast", quality: "medium" }] },
  { id: "groq", name: "Groq", isLocal: false, hasApiKey: false, defaultModel: "llama-3.3-70b-versatile", models: [{ id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", speed: "fast", quality: "high" }] },
  { id: "mistral", name: "Mistral AI", isLocal: false, hasApiKey: false, defaultModel: "mistral-large-latest", models: [{ id: "mistral-large-latest", name: "Mistral Large", speed: "medium", quality: "high" }] },
  { id: "deepseek", name: "DeepSeek", isLocal: false, hasApiKey: false, defaultModel: "deepseek-chat", models: [{ id: "deepseek-chat", name: "DeepSeek V3", speed: "fast", quality: "high" }] },
];

export function PlaygroundContent() {
  const [providers, setProviders] = useState<ProviderInfo[]>(FALLBACK_PROVIDERS);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [adaptiveRouting, setAdaptiveRouting] = useState(true);
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
      setBaseline(data.baseline);
      setGraphrag(data.graphrag);
      setComplexity(data.complexity ?? 0);
      setQueryType(data.queryType ?? "");
      setRecommended(data.recommended ?? "");
      setDemoMode(data.demoMode ?? false);
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  const chartData = baseline && graphrag ? [
    { name: "Tokens", Baseline: baseline.tokens, GraphRAG: graphrag.tokens },
    { name: "Latency (ms)", Baseline: Math.round(baseline.latencyMs), GraphRAG: Math.round(graphrag.latencyMs) },
  ] : [];

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
              placeholder="Ask a multi-hop question… e.g., Were Scott Derrickson and Ed Wood of the same nationality?"
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
                <>▶ Compare Pipelines</>
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
                {ex.q.slice(0, 45)}…
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
            <strong>Demo Mode</strong> — Showing sample data. Set your API key for live results.
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
                {recommended === "graphrag" ? "GraphRAG" : "Baseline RAG"}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      {baseline && graphrag && (
        <div className="animate-fade-in-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Baseline Card */}
            <div className="card pipeline-baseline" style={{ position: "relative" }}>
              <div style={{
                position: "absolute", top: "16px", right: "16px",
                width: "8px", height: "8px", borderRadius: "50%",
                background: "#0072CE",
                boxShadow: "0 0 8px rgba(0,114,206,0.4)",
              }} />
              <div className="caption-uppercase mb-1" style={{ color: "#0072CE" }}>Pipeline A</div>
              <div className="title-lg mb-4">Baseline RAG</div>
              <div className="body-md mb-6" style={{ minHeight: "80px", lineHeight: 1.65 }}>
                {baseline.answer}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                <div>
                  <div className="metric-value-sm" style={{ color: "#0072CE" }}>{baseline.tokens.toLocaleString()}</div>
                  <div className="metric-label">Tokens</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: "#0072CE" }}>{baseline.latencyMs.toFixed(0)}ms</div>
                  <div className="metric-label">Latency</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: "#0072CE" }}>${baseline.costUsd.toFixed(6)}</div>
                  <div className="metric-label">Cost</div>
                </div>
              </div>
            </div>

            {/* GraphRAG Card */}
            <div className="card pipeline-graphrag" style={{ position: "relative" }}>
              <div style={{
                position: "absolute", top: "16px", right: "16px",
                width: "8px", height: "8px", borderRadius: "50%",
                background: "#FF6B00",
                boxShadow: "0 0 8px rgba(255,107,0,0.4)",
              }} />
              <div className="caption-uppercase mb-1" style={{ color: "#FF6B00" }}>Pipeline B</div>
              <div className="title-lg mb-4">GraphRAG</div>
              <div className="body-md mb-6" style={{ minHeight: "80px", lineHeight: 1.65 }}>
                {graphrag.answer}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                <div>
                  <div className="metric-value-sm" style={{ color: "#FF6B00" }}>{graphrag.tokens.toLocaleString()}</div>
                  <div className="metric-label">Tokens</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: "#FF6B00" }}>{graphrag.latencyMs.toFixed(0)}ms</div>
                  <div className="metric-label">Latency</div>
                </div>
                <div>
                  <div className="metric-value-sm" style={{ color: "#FF6B00" }}>${graphrag.costUsd.toFixed(6)}</div>
                  <div className="metric-label">Cost</div>
                </div>
              </div>

              {/* Entities & Relations */}
              {graphrag.entities.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                  <div className="caption mb-2">Extracted Entities</div>
                  <div className="flex flex-wrap gap-1.5">
                    {graphrag.entities.map((e, i) => (
                      <span key={i} className="badge-outline" style={{ fontSize: "0.6875rem" }}>{e}</span>
                    ))}
                  </div>
                  {graphrag.relations.length > 0 && (
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

          {/* Comparison Chart */}
          {chartData.length > 0 && (
            <div className="card">
              <div className="title-md mb-6">Side-by-Side Metrics</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#002B49" strokeOpacity={0.06} />
                  <XAxis dataKey="name" tick={{ fill: "#6c6a64", fontSize: 13 }} />
                  <YAxis tick={{ fill: "#6c6a64", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "10px" }} />
                  <Legend />
                  <Bar dataKey="Baseline" fill="#0072CE" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="GraphRAG" fill="#FF6B00" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
