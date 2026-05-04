/**
 * Universal LLM Provider Layer
 * =============================
 * Single interface for 12+ LLM providers using OpenAI SDK with dynamic baseURL.
 * Zero extra dependencies — all providers speak OpenAI-compatible API.
 *
 * Supported: OpenAI, Anthropic Claude, Google Gemini, Mistral, Cohere,
 *            Ollama (local), OpenRouter, Groq, xAI Grok, Together AI,
 *            HuggingFace Inference, DeepSeek
 */

export type ProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "mistral"
  | "cohere"
  | "ollama"
  | "openrouter"
  | "groq"
  | "xai"
  | "together"
  | "huggingface"
  | "deepseek";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseURL: string;
  apiKeyEnv: string; // env var name
  defaultModel: string;
  models: ModelInfo[];
  isLocal?: boolean; // Ollama etc
  requiresApiKey?: boolean;
  costPer1kInput: number; // USD
  costPer1kOutput: number;
  supportsStreaming: boolean;
  supportsJSON: boolean;
  maxContextWindow: number;
  notes?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  speed: "fast" | "medium" | "slow";
  quality: "high" | "medium" | "low";
}

export interface LLMRequest {
  provider: ProviderId;
  model?: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
  model: string;
  provider: ProviderId;
}

// ── Provider Registry ──────────────────────────────────

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI / BotLearn",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: process.env.LLM_MODEL || "gpt-4o-mini",
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 1048576,
    requiresApiKey: true,
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1048576, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, speed: "fast", quality: "high" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1048576, costPer1kInput: 0.0001, costPer1kOutput: 0.0004, speed: "fast", quality: "medium" },
      { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, costPer1kInput: 0.0025, costPer1kOutput: 0.01, speed: "medium", quality: "high" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, speed: "fast", quality: "medium" },
    ],
  },

  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    baseURL: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-20250514",
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    supportsStreaming: true,
    supportsJSON: false, // uses tool_use pattern
    maxContextWindow: 200000,
    requiresApiKey: true,
    notes: "Uses native Anthropic SDK, not OpenAI-compat",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000, costPer1kInput: 0.003, costPer1kOutput: 0.015, speed: "medium", quality: "high" },
      { id: "claude-opus-4-20250514", name: "Claude Opus 4", contextWindow: 200000, costPer1kInput: 0.015, costPer1kOutput: 0.075, speed: "slow", quality: "high" },
      { id: "claude-haiku-4-20250514", name: "Claude Haiku 4", contextWindow: 200000, costPer1kInput: 0.0008, costPer1kOutput: 0.004, speed: "fast", quality: "medium" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", contextWindow: 200000, costPer1kInput: 0.003, costPer1kOutput: 0.015, speed: "medium", quality: "high" },
    ],
  },

  gemini: {
    id: "gemini",
    name: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKeyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-2.0-flash",
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 1048576,
    requiresApiKey: true,
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1048576, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, speed: "fast", quality: "high" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1048576, costPer1kInput: 0.0001, costPer1kOutput: 0.0004, speed: "fast", quality: "medium" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 1048576, costPer1kInput: 0.00125, costPer1kOutput: 0.005, speed: "medium", quality: "high" },
    ],
  },

  mistral: {
    id: "mistral",
    name: "Mistral AI",
    baseURL: "https://api.mistral.ai/v1",
    apiKeyEnv: "MISTRAL_API_KEY",
    defaultModel: "mistral-large-latest",
    costPer1kInput: 0.002,
    costPer1kOutput: 0.006,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 128000,
    requiresApiKey: true,
    models: [
      { id: "mistral-large-latest", name: "Mistral Large", contextWindow: 128000, costPer1kInput: 0.002, costPer1kOutput: 0.006, speed: "medium", quality: "high" },
      { id: "mistral-small-latest", name: "Mistral Small", contextWindow: 128000, costPer1kInput: 0.0002, costPer1kOutput: 0.0006, speed: "fast", quality: "medium" },
      { id: "codestral-latest", name: "Codestral", contextWindow: 256000, costPer1kInput: 0.0003, costPer1kOutput: 0.0009, speed: "fast", quality: "high" },
    ],
  },

  cohere: {
    id: "cohere",
    name: "Cohere",
    baseURL: "https://api.cohere.ai/compatibility/v1",
    apiKeyEnv: "COHERE_API_KEY",
    defaultModel: "command-r-plus",
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 128000,
    requiresApiKey: true,
    models: [
      { id: "command-r-plus", name: "Command R+", contextWindow: 128000, costPer1kInput: 0.0025, costPer1kOutput: 0.01, speed: "medium", quality: "high" },
      { id: "command-r", name: "Command R", contextWindow: 128000, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, speed: "fast", quality: "medium" },
    ],
  },

  ollama: {
    id: "ollama",
    name: "Ollama (Local)",
    baseURL: "http://localhost:11434/v1",
    apiKeyEnv: "",
    defaultModel: "llama3.2",
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 131072,
    isLocal: true,
    requiresApiKey: false,
    notes: "Free, runs locally. Install Ollama then: ollama pull llama3.2",
    models: [
      { id: "llama3.2", name: "Llama 3.2 3B", contextWindow: 131072, costPer1kInput: 0, costPer1kOutput: 0, speed: "fast", quality: "medium" },
      { id: "llama3.2:1b", name: "Llama 3.2 1B", contextWindow: 131072, costPer1kInput: 0, costPer1kOutput: 0, speed: "fast", quality: "low" },
      { id: "qwen2.5:7b", name: "Qwen 2.5 7B", contextWindow: 131072, costPer1kInput: 0, costPer1kOutput: 0, speed: "medium", quality: "medium" },
      { id: "qwen2.5:14b", name: "Qwen 2.5 14B", contextWindow: 131072, costPer1kInput: 0, costPer1kOutput: 0, speed: "slow", quality: "high" },
      { id: "deepseek-r1:7b", name: "DeepSeek R1 7B", contextWindow: 65536, costPer1kInput: 0, costPer1kOutput: 0, speed: "medium", quality: "high" },
      { id: "mistral:7b", name: "Mistral 7B", contextWindow: 32768, costPer1kInput: 0, costPer1kOutput: 0, speed: "fast", quality: "medium" },
      { id: "gemma2:9b", name: "Gemma 2 9B", contextWindow: 8192, costPer1kInput: 0, costPer1kOutput: 0, speed: "medium", quality: "medium" },
      { id: "phi3:14b", name: "Phi-3 14B", contextWindow: 131072, costPer1kInput: 0, costPer1kOutput: 0, speed: "medium", quality: "high" },
    ],
  },

  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    costPer1kInput: 0.0004,
    costPer1kOutput: 0.0004,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 131072,
    requiresApiKey: true,
    notes: "Access 200+ models from all providers via single API key",
    models: [
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", contextWindow: 131072, costPer1kInput: 0.0004, costPer1kOutput: 0.0004, speed: "medium", quality: "high" },
      { id: "google/gemini-2.0-flash-exp:free", name: "Gemini Flash (Free)", contextWindow: 1048576, costPer1kInput: 0, costPer1kOutput: 0, speed: "fast", quality: "medium" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1", contextWindow: 65536, costPer1kInput: 0.0005, costPer1kOutput: 0.002, speed: "slow", quality: "high" },
      { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", contextWindow: 131072, costPer1kInput: 0.0004, costPer1kOutput: 0.0004, speed: "medium", quality: "high" },
    ],
  },

  groq: {
    id: "groq",
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    costPer1kInput: 0.00059,
    costPer1kOutput: 0.00079,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 131072,
    requiresApiKey: true,
    notes: "Ultra-fast inference on custom LPU hardware",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 131072, costPer1kInput: 0.00059, costPer1kOutput: 0.00079, speed: "fast", quality: "high" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", contextWindow: 131072, costPer1kInput: 0.00005, costPer1kOutput: 0.00008, speed: "fast", quality: "medium" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", contextWindow: 32768, costPer1kInput: 0.00024, costPer1kOutput: 0.00024, speed: "fast", quality: "medium" },
    ],
  },

  xai: {
    id: "xai",
    name: "xAI Grok",
    baseURL: "https://api.x.ai/v1",
    apiKeyEnv: "XAI_API_KEY",
    defaultModel: "grok-3-mini",
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 131072,
    requiresApiKey: true,
    models: [
      { id: "grok-3-mini", name: "Grok 3 Mini", contextWindow: 131072, costPer1kInput: 0.0003, costPer1kOutput: 0.0005, speed: "fast", quality: "medium" },
      { id: "grok-3", name: "Grok 3", contextWindow: 131072, costPer1kInput: 0.003, costPer1kOutput: 0.015, speed: "medium", quality: "high" },
    ],
  },

  together: {
    id: "together",
    name: "Together AI",
    baseURL: "https://api.together.xyz/v1",
    apiKeyEnv: "TOGETHER_API_KEY",
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    costPer1kInput: 0.00088,
    costPer1kOutput: 0.00088,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 131072,
    requiresApiKey: true,
    models: [
      { id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", name: "Llama 3.1 70B Turbo", contextWindow: 131072, costPer1kInput: 0.00088, costPer1kOutput: 0.00088, speed: "fast", quality: "high" },
      { id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", name: "Llama 3.1 8B Turbo", contextWindow: 131072, costPer1kInput: 0.00018, costPer1kOutput: 0.00018, speed: "fast", quality: "medium" },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", name: "Qwen 2.5 72B Turbo", contextWindow: 131072, costPer1kInput: 0.0012, costPer1kOutput: 0.0012, speed: "fast", quality: "high" },
    ],
  },

  huggingface: {
    id: "huggingface",
    name: "HuggingFace Inference",
    baseURL: "https://api-inference.huggingface.co/v1",
    apiKeyEnv: "HF_TOKEN",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportsStreaming: true,
    supportsJSON: false,
    maxContextWindow: 131072,
    requiresApiKey: true,
    notes: "Free tier available, PRO for higher limits",
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", contextWindow: 131072, costPer1kInput: 0, costPer1kOutput: 0, speed: "medium", quality: "high" },
      { id: "Qwen/Qwen2.5-72B-Instruct", name: "Qwen 2.5 72B", contextWindow: 131072, costPer1kInput: 0, costPer1kOutput: 0, speed: "medium", quality: "high" },
      { id: "mistralai/Mistral-7B-Instruct-v0.3", name: "Mistral 7B", contextWindow: 32768, costPer1kInput: 0, costPer1kOutput: 0, speed: "fast", quality: "medium" },
    ],
  },

  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
    supportsStreaming: true,
    supportsJSON: true,
    maxContextWindow: 65536,
    requiresApiKey: true,
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3", contextWindow: 65536, costPer1kInput: 0.00014, costPer1kOutput: 0.00028, speed: "fast", quality: "high" },
      { id: "deepseek-reasoner", name: "DeepSeek R1", contextWindow: 65536, costPer1kInput: 0.00055, costPer1kOutput: 0.00219, speed: "slow", quality: "high" },
    ],
  },
};

// ── Universal LLM Client ─────────────────────────────────

export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  const provider = PROVIDERS[request.provider];
  if (!provider) throw new Error(`Unknown provider: ${request.provider}`);

  const model = request.model || provider.defaultModel;
  const modelInfo = provider.models.find((m) => m.id === model) || provider.models[0];
  const startTime = Date.now();

  // ── Anthropic uses its own SDK ───────────────────────
  if (request.provider === "anthropic") {
    return callAnthropic(request, provider, modelInfo, startTime);
  }

  // ── All other providers use OpenAI SDK ───────────────
  const OpenAI = (await import("openai")).default;

  const apiKey = provider.isLocal
    ? "ollama"
    : process.env[provider.apiKeyEnv] || "";

  if (!apiKey && provider.requiresApiKey) {
    throw new Error(`Missing API key: set ${provider.apiKeyEnv} environment variable`);
  }

  const client = new OpenAI({
    baseURL: provider.baseURL,
    apiKey,
  });

  const params: Record<string, unknown> = {
    model,
    messages: request.messages,
    temperature: request.temperature ?? 0,
    max_tokens: request.maxTokens ?? 1024,
  };

  if (request.jsonMode && provider.supportsJSON) {
    params.response_format = { type: "json_object" };
  }

  const response = await client.chat.completions.create(params as never);
  const latencyMs = Date.now() - startTime;

  const content = response.choices?.[0]?.message?.content || "";
  const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  return {
    content,
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    latencyMs,
    costUsd:
      (usage.prompt_tokens / 1000) * modelInfo.costPer1kInput +
      (usage.completion_tokens / 1000) * modelInfo.costPer1kOutput,
    model,
    provider: request.provider,
  };
}

// ── Anthropic-specific handler ────────────────────────

async function callAnthropic(
  request: LLMRequest,
  provider: ProviderConfig,
  modelInfo: ModelInfo,
  startTime: number
): Promise<LLMResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env[provider.apiKeyEnv] });

  const systemMsg = request.messages.find((m) => m.role === "system");
  const userMsgs = request.messages.filter((m) => m.role !== "system");

  const model = request.model || provider.defaultModel;

  const msg = await client.messages.create({
    model,
    max_tokens: request.maxTokens ?? 1024,
    temperature: request.temperature ?? 0,
    system: systemMsg?.content || undefined,
    messages: userMsgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  });

  const latencyMs = Date.now() - startTime;
  const content = msg.content[0]?.type === "text" ? msg.content[0].text : "";

  return {
    content,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
    totalTokens: msg.usage.input_tokens + msg.usage.output_tokens,
    latencyMs,
    costUsd:
      (msg.usage.input_tokens / 1000) * modelInfo.costPer1kInput +
      (msg.usage.output_tokens / 1000) * modelInfo.costPer1kOutput,
    model,
    provider: "anthropic",
  };
}

// ── Helper: Check if Ollama is running ───────────────

export async function checkOllamaHealth(): Promise<{ ok: boolean; models: string[] }> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ok: false, models: [] };
    const data = await res.json();
    return {
      ok: true,
      models: (data.models || []).map((m: { name: string }) => m.name),
    };
  } catch {
    return { ok: false, models: [] };
  }
}

// ── Helper: List available providers (those with API keys set) ──

export function getAvailableProviders(): ProviderId[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).filter((id) => {
    const p = PROVIDERS[id];
    if (p.isLocal) return true; // Ollama always listed
    if (!p.requiresApiKey) return true;
    return !!process.env[p.apiKeyEnv];
  });
}

// ── Provider display info for UI ─────────────────────

export function getProviderDisplayInfo() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    isLocal: p.isLocal ?? false,
    hasApiKey: p.isLocal || !p.requiresApiKey || !!process.env[p.apiKeyEnv],
    defaultModel: p.defaultModel,
    models: p.models,
    costPer1kInput: p.costPer1kInput,
    costPer1kOutput: p.costPer1kOutput,
    notes: p.notes,
  }));
}
