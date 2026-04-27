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
  notes?: string;
}

interface ComparisonState {
  loading: boolean;
  query: string;
  baseline: PipelineResult | null;
  graphrag: PipelineResult | null;
  complexity: number;
  queryType: string;
  recommended: string;
  provider: string;
  model: string;
  demoMode: boolean;
}

const EXAMPLES = [
  "Were Scott Derrickson and Ed Wood of the same nationality?",
  "What government position was held by the woman who portrayed Nora Batty?",
  "Which magazine was started first, Arthur's Magazine or First for Women?",
  "Who was born first, Arthur Conan Doyle or Agatha Christie?",
  "What is the capital of the country where the Eiffel Tower is located?",
];

const FALLBACK_PROVIDERS: ProviderInfo[] = [
  { id: "anthropic", name: "Anthropic Claude", isLocal: false, hasApiKey: false, defaultModel: "claude-sonnet-4-20250514", models: [{ id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", speed: "medium", quality: "high" }] },
  { id: "openai", name: "OpenAI", isLocal: false, hasApiKey: false, defaultModel: "gpt-4o-mini", models: [{ id: "gpt-4o-mini", name: "GPT-4o Mini", speed: "fast", quality: "medium" }] },
  { id: "gemini", name: "Google Gemini", isLocal: false, hasApiKey: false, defaultModel: "gemini-2.0-flash", models: [{ id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", speed: "fast", quality: "medium" }] },
  { id: "ollama", name: "Ollama (Local)", isLocal: true, hasApiKey: true, defaultModel: "llama3.2", models: [{ id: "llama3.2", name: "Llama 3.2 3B", speed: "fast", quality: "medium" }] },
  { id: "groq", name: "Groq", isLocal: false, hasApiKey: false, defaultModel: "llama-3.3-70b-versatile", models: [{ id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", speed: "fast", quality: "high" }] },
  { id: "mistral", name: "Mistral AI", isLocal: false, hasApiKey: false, defaultModel: "mistral-large-latest", models: [{ id: "mistral-large-latest", name: "Mistral Large", speed: "medium", quality: "high" }] },
  { id: "deepseek", name: "DeepSeek", isLocal: false, hasApiKey: false, defaultModel: "deepseek-chat", models: [{ id: "deepseek-chat", name: "DeepSeek V3", speed: "fast", quality: "high" }] },
  { id: "openrouter", name: "OpenRouter", isLocal: false, hasApiKey: false, defaultModel: "meta-llama/llama-3.3-70b-instruct", models: [{ id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", speed: "medium", quality: "high" }] },
  { id: "cohere", name: "Cohere", isLocal: false, hasApiKey: false, defaultModel: "command-r-plus", models: [{ id: "command-r-plus", name: "Command R+", speed: "medium", quality: "high" }] },
  { id: "xai", name: "xAI Grok", isLocal: false, hasApiKey: false, defaultModel: "grok-3-mini", models: [{ id: "grok-3-mini", name: "Grok 3 Mini", speed: "fast", quality: "medium" }] },
  { id: "together", name: "Together AI", isLocal: false, hasApiKey: false, defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", models: [{ id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", name: "Llama 3.1 70B", speed: "fast", quality: "high" }] },
  { id: "huggingface", name: "HuggingFace", isLocal: false, hasApiKey: false, defaultModel: "meta-llama/Llama-3.3-70B-Instruct", models: [{ id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", speed: "medium", quality: "high" }] },
];

export function LiveCompare() {
  const [providers, setProviders] = useState<ProviderInfo[]>(FALLBACK_PROVIDERS);
  const [state, setState] = useState<ComparisonState>({
    loading: false, query: "", baseline: null, graphrag: null,
    complexity: 0, queryType: "", recommended: "",
    provider: "anthropic", model: "", demoMode: false,
  });
  const [adaptiveRouting, setAdaptiveRouting] = useState(true);

  // Fetch available providers on mount
  useEffect(() => {
    fetch("/api/providers").then(r => r.json()).then(d => {
      if (d.providers) setProviders(d.providers);
    }).catch(() => {});
  }, []);

  const selectedProvider = providers.find(p => p.id === state.provider) || providers[0];
  const selectedModel = state.model || selectedProvider?.defaultModel || "";

  const runComparison = async () => {
    if (!state.query.trim()) return;
    setState(s => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: state.query, adaptiveRouting,
          provider: state.provider, model: selectedModel,
        }),
      });
      const data = await res.json();
      setState(s => ({
        ...s, loading: false,
        baseline: data.baseline, graphrag: data.graphrag,
        complexity: data.complexity ?? 0, queryType: data.queryType ?? "",
        recommended: data.recommended ?? "",
        demoMode: data.demoMode ?? false,
      }));
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  };

  const chartData = state.baseline && state.graphrag ? [
    { name: "Tokens", Baseline: state.baseline.tokens, GraphRAG: state.graphrag.tokens },
    { name: "Latency (ms)", Baseline: Math.round(state.baseline.latencyMs), GraphRAG: Math.round(state.graphrag.latencyMs) },
  ] : [];

  return (
    <div>
      {/* Provider + Model Selector */}
      <div className="card mb-4" style={{ padding: "16px" }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="caption mb-1 block">LLM Provider</label>
            <select
              className="input"
              value={state.provider}
              onChange={e => setState(s => ({ ...s, provider: e.target.value, model: "" }))}
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.isLocal ? "🦙 " : ""}{p.name} {p.hasApiKey ? "✅" : "🔑"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="caption mb-1 block">Model</label>
            <select
              className="input"
              value={selectedModel}
              onChange={e => setState(s => ({ ...s, model: e.target.value }))}
            >
              {selectedProvider?.models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.speed}/{m.quality})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            {selectedProvider?.isLocal && (
              <span className="badge-success" style={{ fontSize: "0.6875rem" }}>Free / Local</span>
            )}
            {!selectedProvider?.hasApiKey && !selectedProvider?.isLocal && (
              <span className="badge-outline" style={{ fontSize: "0.6875rem" }}>Demo Mode</span>
            )}
          </div>
        </div>
      </div>

      {/* Query Input */}
      <div className="card mb-6">
        <div className="display-sm mb-4">Ask a question</div>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <textarea
              className="input textarea"
              placeholder="e.g., Were Scott Derrickson and Ed Wood of the same nationality?"
              value={state.query}
              onChange={e => setState(s => ({ ...s, query: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runComparison(); } }}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-3 lg:w-48">
            <label className="flex items-center gap-2 cursor-pointer caption">
              <input type="checkbox" checked={adaptiveRouting}
                onChange={e => setAdaptiveRouting(e.target.checked)}
                className="w-4 h-4 accent-[#FF6B00]" />
              🧠 Adaptive Routing
            </label>
            <button className="btn btn-primary btn-lg w-full"
              onClick={runComparison} disabled={state.loading || !state.query.trim()}>
              {state.loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Running…
                </span>
              ) : "▶ Compare"}
            </button>
          </div>
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="caption">Try:</span>
          {EXAMPLES.slice(0, 3).map((q, i) => (
            <button key={i} className="badge-outline cursor-pointer hover:bg-surface-soft transition-colors"
              style={{ fontSize: "0.75rem" }} onClick={() => setState(s => ({ ...s, query: q }))}>
              {q.slice(0, 50)}…
            </button>
          ))}
        </div>
      </div>

      {/* Demo Mode Warning */}
      {state.demoMode && state.baseline && (
        <div className="card-cream mb-4 flex items-center gap-3" style={{ padding: "12px 20px" }}>
          <span style={{ fontSize: "1.2rem" }}>ℹ️</span>
          <span className="body-sm">
            <strong>Demo Mode</strong> — No API key for {selectedProvider?.name}. Showing sample data.
            Set <code>{selectedProvider?.id === "ollama" ? "ollama pull llama3.2" : `${providers.find(p=>p.id===state.provider)?.id?.toUpperCase()}_API_KEY`}</code> for live results.
          </span>
        </div>
      )}

      {/* Adaptive Routing */}
      {state.recommended && !state.demoMode && (
        <div className="card-cream mb-6 flex items-center gap-4 flex-wrap" style={{ padding: "12px 20px" }}>
          <span className="badge-orange">🧠 Adaptive Router</span>
          <span className="body-sm">
            Complexity: <strong>{state.complexity.toFixed(2)}</strong> · Type: <strong>{state.queryType}</strong> · Recommended:{" "}
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
            {/* Baseline */}
            <div className="card pipeline-baseline">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ background: "#0072CE" }} />
                <span className="title-md">Baseline RAG</span>
                <span className="badge-blue ml-auto">Pipeline A</span>
              </div>
              <p className="body-md mb-4" style={{ minHeight: "80px" }}>{state.baseline.answer}</p>
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

            {/* GraphRAG */}
            <div className="card pipeline-graphrag">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ background: "#FF6B00" }} />
                <span className="title-md">GraphRAG</span>
                <span className="badge-orange ml-auto">Pipeline B</span>
              </div>
              <p className="body-md mb-4" style={{ minHeight: "80px" }}>{state.graphrag.answer}</p>
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

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="card">
              <div className="title-md mb-4">Metrics Comparison</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#002B49" strokeOpacity={0.08} />
                  <XAxis dataKey="name" tick={{ fill: "#6c6a64", fontSize: 13 }} />
                  <YAxis tick={{ fill: "#6c6a64", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#faf9f5", border: "1px solid #e6dfd8", borderRadius: "8px" }} />
                  <Legend />
                  <Bar dataKey="Baseline" fill="#0072CE" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="GraphRAG" fill="#FF6B00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
