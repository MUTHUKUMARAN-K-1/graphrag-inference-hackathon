import { NextRequest, NextResponse } from "next/server";
import { callLLM, PROVIDERS, type ProviderId } from "@/lib/llm-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CompareRequest {
  query: string;
  provider?: ProviderId;
  model?: string;
  adaptiveRouting?: boolean;
  topK?: number;
  hops?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: CompareRequest = await req.json();
    const { query, provider = "anthropic", model, adaptiveRouting = true } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query required" }, { status: 400 });
    }

    // Check if provider has API key (or is local)
    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    const hasKey = providerConfig.isLocal || !providerConfig.requiresApiKey || !!process.env[providerConfig.apiKeyEnv];
    if (!hasKey) {
      return NextResponse.json(getDemoResponse(query, provider));
    }

    const selectedModel = model || providerConfig.defaultModel;
    const startTime = Date.now();

    // ── Pipeline A: Baseline RAG ────────────────────────
    const baselineResp = await callLLM({
      provider,
      model: selectedModel,
      messages: [
        { role: "system", content: "You are a helpful assistant. Answer the question accurately and concisely." },
        { role: "user", content: `Question: ${query}\n\nAnswer:` },
      ],
      temperature: 0,
      maxTokens: 512,
    });

    // ── Pipeline B: GraphRAG ────────────────────────────
    // Step 1: Keywords
    const kwResp = await callLLM({
      provider,
      model: selectedModel,
      messages: [
        { role: "system", content: 'Extract keywords. Return JSON: {"high_level": ["themes"], "low_level": ["entities"]}' },
        { role: "user", content: query },
      ],
      temperature: 0,
      maxTokens: 256,
      jsonMode: providerConfig.supportsJSON,
    });

    // Step 2: Entity extraction
    const entityResp = await callLLM({
      provider,
      model: selectedModel,
      messages: [
        { role: "system", content: `Extract entities and relationships. Return JSON:
{"entities": [{"name": "...", "type": "PERSON|ORG|LOCATION|EVENT|CONCEPT"}],
 "relations": [{"source": "name", "target": "name", "type": "...", "description": "brief"}]}` },
        { role: "user", content: query },
      ],
      temperature: 0,
      maxTokens: 1024,
      jsonMode: providerConfig.supportsJSON,
    });

    let entities: string[] = [];
    let relations: string[] = [];
    try {
      const parsed = JSON.parse(entityResp.content);
      entities = (parsed.entities || []).map((e: { name: string }) => e.name);
      relations = (parsed.relations || []).map(
        (r: { source: string; type: string; target: string; description?: string }) =>
          `${r.source} -[${r.type}]-> ${r.target}: ${r.description || ""}`
      );
    } catch { /* parse errors OK — content may not be pure JSON */ }

    // Step 3: Generate with graph context
    const graphContext = `### Entities:\n${entities.map((e) => `- ${e}`).join("\n")}\n\n### Relations:\n${relations.map((r) => `- ${r}`).join("\n")}`;

    const graphragResp = await callLLM({
      provider,
      model: selectedModel,
      messages: [
        { role: "system", content: "You are a knowledgeable assistant with knowledge graph access. Use entities and relationships to answer accurately. Follow relationship chains for multi-hop reasoning. Be concise." },
        { role: "user", content: `Context:\n${graphContext}\n\nQuestion: ${query}\n\nAnswer:` },
      ],
      temperature: 0,
      maxTokens: 512,
    });

    const graphragTotalTokens = kwResp.totalTokens + entityResp.totalTokens + graphragResp.totalTokens;
    const graphragTotalCost = kwResp.costUsd + entityResp.costUsd + graphragResp.costUsd;
    const graphragLatency = kwResp.latencyMs + entityResp.latencyMs + graphragResp.latencyMs;

    // Adaptive routing
    let complexity = 0.5, queryType = "unknown", recommended = "baseline";
    if (adaptiveRouting) {
      const multi = entities.length > 2;
      const compare = /same|both|compare|which.*first|who.*born|difference/i.test(query);
      const hops = relations.length > 2;
      complexity = Math.min((multi ? 0.3 : 0) + (compare ? 0.2 : 0) + (hops ? 0.3 : 0.1) + 0.1, 1.0);
      queryType = compare ? "comparison" : hops ? "multi_hop" : "factoid";
      recommended = complexity >= 0.6 ? "graphrag" : "baseline";
    }

    return NextResponse.json({
      baseline: {
        answer: baselineResp.content,
        tokens: baselineResp.totalTokens,
        latencyMs: baselineResp.latencyMs,
        costUsd: baselineResp.costUsd,
        entities: [],
        relations: [],
      },
      graphrag: {
        answer: graphragResp.content,
        tokens: graphragTotalTokens,
        latencyMs: graphragLatency,
        costUsd: graphragTotalCost,
        entities,
        relations,
      },
      complexity,
      queryType,
      recommended,
      provider,
      model: selectedModel,
      totalTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("Compare API error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(getDemoResponse("", "anthropic", errMsg));
  }
}

function getDemoResponse(query: string, provider: string, error?: string) {
  return {
    baseline: {
      answer: "Both Scott Derrickson and Ed Wood were American filmmakers.",
      tokens: 847, latencyMs: 1240, costUsd: 0.000203,
      entities: [], relations: [],
    },
    graphrag: {
      answer: "Yes. Scott Derrickson (Denver, CO → USA) and Ed Wood (Poughkeepsie, NY → USA) were both American. Graph traversal confirms shared nationality via BORN_IN → LOCATED_IN → United States paths.",
      tokens: 2134, latencyMs: 3820, costUsd: 0.000518,
      entities: ["Scott Derrickson", "Ed Wood", "United States", "Denver", "Poughkeepsie"],
      relations: ["Scott Derrickson -[BORN_IN]-> Denver", "Denver -[LOCATED_IN]-> United States", "Ed Wood -[BORN_IN]-> Poughkeepsie", "Poughkeepsie -[LOCATED_IN]-> United States"],
    },
    complexity: 0.72, queryType: "comparison", recommended: "graphrag",
    provider, model: "demo-mode", totalTimeMs: 5060,
    ...(error ? { demoMode: true, demoReason: error } : { demoMode: true, demoReason: "No API key configured" }),
  };
}
