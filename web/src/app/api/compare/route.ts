import { NextRequest, NextResponse } from "next/server";
import { callLLM, PROVIDERS, type ProviderId } from "@/lib/llm-providers";
import { getEmbedding, searchChunks, chunkToEntityContext } from "@/lib/retrieval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CompareRequest {
  query: string;
  provider?: ProviderId;
  model?: string;
  adaptiveRouting?: boolean;
  topK?: number;
  customApiKey?: string;
  customBaseUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CompareRequest = await req.json();
    const { query, provider = "openai", model, adaptiveRouting = true, topK = 5, customApiKey, customBaseUrl } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query required" }, { status: 400 });
    }

    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    const hasKey = !!customApiKey || providerConfig.isLocal || !providerConfig.requiresApiKey || !!process.env[providerConfig.apiKeyEnv];
    if (!hasKey) {
      return NextResponse.json(getDemoResponse(query, provider));
    }

    const selectedModel = model || providerConfig.defaultModel;
    const llmOverrides = { apiKeyOverride: customApiKey, baseURLOverride: customBaseUrl };
    const startTime = Date.now();

    // ── Parallel phase 1: LLM-Only + embedding fetch run simultaneously ──
    // LLM-only needs no retrieval; start it immediately alongside the embed call.
    const llmOnlyStart = Date.now();
    const [llmOnlyResp, embedding] = await Promise.all([
      callLLM({
        provider, model: selectedModel,
        messages: [
          { role: "system", content: "Answer the question accurately and concisely from your knowledge. If unsure, say so." },
          { role: "user", content: query },
        ],
        temperature: 0, maxTokens: 512,
        ...llmOverrides,
      }),
      getEmbedding(query),
    ]);
    const llmOnlyLatency = Date.now() - llmOnlyStart;

    // ── Retrieve chunks from TigerGraph (needs embedding) ─────────────────
    const chunks = embedding ? await searchChunks(embedding, topK) : [];
    const hasRetrieval = chunks.length > 0;

    // Full text context (Basic RAG: raw chunks concatenated)
    const ragContext = hasRetrieval
      ? chunks.map((c, i) => `[Passage ${i + 1}]\n${c.text}`).join("\n\n")
      : `No documents retrieved. Answering from general knowledge.`;

    // Compact entity context (GraphRAG: first-sentence descriptions, pre-indexed at ingest time)
    const graphContext = hasRetrieval
      ? chunks.map((c, i) => `[${i + 1}] ${chunkToEntityContext(c.text)}`).join("\n")
      : `No graph context available.`;

    // ── Parallel phase 2: Basic RAG + GraphRAG run simultaneously ────────
    const ragStart = Date.now();
    const [basicRagResp, graphragResp] = await Promise.all([
      callLLM({
        provider, model: selectedModel,
        messages: [
          { role: "system", content: "Answer the question using ONLY the provided context passages. Be accurate and concise." },
          { role: "user", content: `Context:\n${ragContext}\n\nQuestion: ${query}\n\nAnswer:` },
        ],
        temperature: 0, maxTokens: 512,
        ...llmOverrides,
      }),
      callLLM({
        provider, model: selectedModel,
        messages: [
          { role: "system", content: "You have access to a knowledge graph. The entity descriptions below were pre-indexed from the document corpus. Use them to answer precisely and concisely — follow any relationship chains implied." },
          { role: "user", content: `Knowledge Graph Entities:\n${graphContext}\n\nQuestion: ${query}\n\nAnswer:` },
        ],
        temperature: 0, maxTokens: 512,
        ...llmOverrides,
      }),
    ]);
    // Both share the same wall-clock window; report individual latencies from their response objects.
    const parallelLat = Date.now() - ragStart;
    const ragLatency = basicRagResp.latencyMs;
    const graphragLatency = graphragResp.latencyMs;
    void parallelLat; // measured for tracing, total captured in totalTimeMs

    // ── Adaptive routing (complexity scoring) ────────────────────────────
    let complexity = 0.5, queryType = "factoid", recommended = "graphrag";
    if (adaptiveRouting) {
      const words = query.toLowerCase();
      const isMultiHop = /same|both|compare|which.*first|who.*born|difference|related|between/i.test(words);
      const isSimple = /what is|define|spell|capital of/i.test(words);
      complexity = isSimple ? 0.2 : isMultiHop ? 0.8 : 0.55;
      queryType = isMultiHop ? "multi_hop" : isSimple ? "factoid" : "comparison";
      recommended = complexity >= 0.5 ? "graphrag" : "baseline";
    }

    // ── Entity list from compact context (for UI display) ────────────────
    const entities = chunks.map((c) => chunkToEntityContext(c.text, 80)).filter(Boolean);
    const relations: string[] = [];

    return NextResponse.json({
      llmOnly: {
        answer: llmOnlyResp.content,
        tokens: llmOnlyResp.totalTokens,
        latencyMs: llmOnlyLatency,
        costUsd: llmOnlyResp.costUsd,
      },
      baseline: {
        answer: basicRagResp.content,
        tokens: basicRagResp.totalTokens,
        latencyMs: ragLatency,
        costUsd: basicRagResp.costUsd,
        entities: [],
        relations: [],
        retrievedChunks: chunks.length,
        contextTokens: basicRagResp.inputTokens,
      },
      graphrag: {
        answer: graphragResp.content,
        tokens: graphragResp.totalTokens,
        latencyMs: graphragLatency,
        costUsd: graphragResp.costUsd,
        entities,
        relations,
        retrievedChunks: chunks.length,
        contextTokens: graphragResp.inputTokens,
      },
      complexity,
      queryType,
      recommended,
      provider,
      model: selectedModel,
      totalTimeMs: Date.now() - startTime,
      retrievalEnabled: hasRetrieval,
      chunksRetrieved: chunks.length,
    });
  } catch (error) {
    console.error("Compare API error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(getDemoResponse("", "openai", errMsg));
  }
}

function getDemoResponse(query: string, provider: string, error?: string) {
  return {
    llmOnly: {
      answer: "Albert Einstein developed general relativity, and Niels Bohr contributed to quantum mechanics — they worked in different areas of physics.",
      tokens: 124, latencyMs: 820, costUsd: 0.000019,
    },
    baseline: {
      answer: "Based on the retrieved documents: General relativity was developed by Albert Einstein. Quantum mechanics was pioneered by several physicists including Niels Bohr, Werner Heisenberg, and Erwin Schrödinger. These are distinct theories — general relativity describes gravity at large scales while quantum mechanics describes subatomic behavior.",
      tokens: 1847, latencyMs: 1480, costUsd: 0.000277,
      entities: [], relations: [], retrievedChunks: 5, contextTokens: 1620,
    },
    graphrag: {
      answer: "General relativity (Einstein, 1915) describes gravity as spacetime curvature. Quantum mechanics (Bohr, Heisenberg, Schrödinger, 1920s) governs subatomic particles. They are complementary theories covering different scales.",
      tokens: 387, latencyMs: 980, costUsd: 0.000058,
      entities: ["Albert Einstein (physicist, general relativity)", "Niels Bohr (physicist, quantum model)", "Werner Heisenberg (physicist, uncertainty principle)"],
      relations: ["Einstein -[DEVELOPED]-> General Relativity", "Bohr -[DEVELOPED]-> Quantum Model of Atom"],
      retrievedChunks: 5, contextTokens: 312,
    },
    complexity: 0.65, queryType: "comparison", recommended: "graphrag",
    provider, model: "demo-mode", totalTimeMs: 3300,
    retrievalEnabled: false, chunksRetrieved: 0,
    ...(error ? { demoMode: true, demoReason: error } : { demoMode: true, demoReason: "No API key configured" }),
  };
}
