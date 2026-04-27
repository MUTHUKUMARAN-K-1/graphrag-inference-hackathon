import { NextRequest, NextResponse } from "next/server";
import { callLLM, PROVIDERS, type ProviderId } from "@/lib/llm-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Inline F1 computation (same as Python evaluation_layer)
function normalizeAnswer(s: string): string {
  return s.toLowerCase()
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function computeF1(prediction: string, groundTruth: string): number {
  const predTokens = normalizeAnswer(prediction).split(/\s+/).filter(Boolean);
  const goldTokens = normalizeAnswer(groundTruth).split(/\s+/).filter(Boolean);
  if (!predTokens.length && !goldTokens.length) return 1.0;
  if (!predTokens.length || !goldTokens.length) return 0.0;
  const predSet = new Map<string, number>();
  predTokens.forEach(t => predSet.set(t, (predSet.get(t) || 0) + 1));
  const goldSet = new Map<string, number>();
  goldTokens.forEach(t => goldSet.set(t, (goldSet.get(t) || 0) + 1));
  let common = 0;
  for (const [token, count] of predSet) {
    common += Math.min(count, goldSet.get(token) || 0);
  }
  if (common === 0) return 0.0;
  const precision = common / predTokens.length;
  const recall = common / goldTokens.length;
  return (2 * precision * recall) / (precision + recall);
}

function computeEM(prediction: string, groundTruth: string): number {
  return normalizeAnswer(prediction) === normalizeAnswer(groundTruth) ? 1.0 : 0.0;
}

// Sample HotpotQA questions (embedded to avoid dataset dependency in Next.js)
const HOTPOTQA_SAMPLES = [
  { question: "Were Scott Derrickson and Ed Wood of the same nationality?", answer: "Yes", type: "comparison" },
  { question: "Which magazine was started first Arthur's Magazine or First for Women?", answer: "Arthur's Magazine", type: "comparison" },
  { question: "Were Pavel Urysohn and Leonid Levin known for the same type of work?", answer: "Yes", type: "comparison" },
  { question: "What film has the director who is of Noth Korean descent?", answer: "In the Line of Duty: The FBI Murders", type: "bridge" },
  { question: "Which tennis player won more Grand Slam titles, Venus Williams or Serena Williams?", answer: "Serena Williams", type: "comparison" },
  { question: "Are the Shinano River and the Tone River both located in Japan?", answer: "Yes", type: "comparison" },
  { question: "What is the capital of the country that contains the Buda Castle?", answer: "Budapest", type: "bridge" },
  { question: "Who was born first, Albert Einstein or Nikola Tesla?", answer: "Nikola Tesla", type: "comparison" },
  { question: "What nationality is the director of the film 'Parasite'?", answer: "South Korean", type: "bridge" },
  { question: "Are both the University of Chicago and Northwestern University in the same state?", answer: "Yes", type: "comparison" },
];

interface BenchmarkRequest {
  numSamples?: number;
  provider?: ProviderId;
  model?: string;
}

export async function POST(req: NextRequest) {
  const body: BenchmarkRequest = await req.json();
  const provider = body.provider || "anthropic";
  const model = body.model;
  const numSamples = Math.min(body.numSamples || 10, HOTPOTQA_SAMPLES.length);

  const providerConfig = PROVIDERS[provider];
  const hasKey = providerConfig?.isLocal || !providerConfig?.requiresApiKey || !!process.env[providerConfig?.apiKeyEnv || ""];

  const results: Record<string, unknown>[] = [];
  let totalBaselineF1 = 0, totalGraphragF1 = 0;
  let totalBaselineEM = 0, totalGraphragEM = 0;
  let totalBaselineTokens = 0, totalGraphragTokens = 0;
  let totalBaselineCost = 0, totalGraphragCost = 0;
  let totalBaselineLatency = 0, totalGraphragLatency = 0;
  let bridgeCount = 0, compCount = 0;
  let bridgeBaseF1 = 0, bridgeGraphF1 = 0;
  let compBaseF1 = 0, compGraphF1 = 0;

  for (let i = 0; i < numSamples; i++) {
    const sample = HOTPOTQA_SAMPLES[i];

    if (!hasKey) {
      // Demo mode: generate plausible mock results
      const bF1 = 0.4 + Math.random() * 0.3;
      const gF1 = bF1 + 0.05 + Math.random() * 0.15;
      const bTokens = 700 + Math.floor(Math.random() * 400);
      const gTokens = 1800 + Math.floor(Math.random() * 800);
      results.push({
        idx: i, query: sample.question, gold: sample.answer, type: sample.type,
        baseline_f1: +bF1.toFixed(4), graphrag_f1: +gF1.toFixed(4),
        baseline_em: Math.random() > 0.6 ? 1 : 0, graphrag_em: Math.random() > 0.5 ? 1 : 0,
        baseline_tokens: bTokens, graphrag_tokens: gTokens,
      });
      totalBaselineF1 += bF1; totalGraphragF1 += gF1;
      totalBaselineTokens += bTokens; totalGraphragTokens += gTokens;
      if (sample.type === "bridge") { bridgeCount++; bridgeBaseF1 += bF1; bridgeGraphF1 += gF1; }
      else { compCount++; compBaseF1 += bF1; compGraphF1 += gF1; }
      continue;
    }

    try {
      // Pipeline A: Baseline
      const baseStart = Date.now();
      const baseResp = await callLLM({
        provider, model,
        messages: [
          { role: "system", content: "Answer the question concisely in 1-3 words if possible." },
          { role: "user", content: sample.question },
        ],
        temperature: 0, maxTokens: 128,
      });
      const baseLat = Date.now() - baseStart;

      // Pipeline B: GraphRAG (entity extraction + graph-context generation)
      const graphStart = Date.now();
      const entityResp = await callLLM({
        provider, model,
        messages: [
          { role: "system", content: 'Extract entities and relationships relevant to this question. Return JSON: {"entities": [{"name": "...", "type": "..."}], "relations": [{"source": "...", "target": "...", "type": "..."}]}' },
          { role: "user", content: sample.question },
        ],
        temperature: 0, maxTokens: 512, jsonMode: providerConfig?.supportsJSON,
      });

      let graphContext = "";
      try {
        const parsed = JSON.parse(entityResp.content);
        const ents = (parsed.entities || []).map((e: {name:string; type:string}) => `- ${e.name} (${e.type})`).join("\n");
        const rels = (parsed.relations || []).map((r: {source:string; target:string; type:string}) => `- ${r.source} → ${r.type} → ${r.target}`).join("\n");
        graphContext = `Entities:\n${ents}\n\nRelationships:\n${rels}`;
      } catch { graphContext = entityResp.content; }

      const graphResp = await callLLM({
        provider, model,
        messages: [
          { role: "system", content: "Using the knowledge graph context, answer concisely in 1-3 words if possible. Follow relationship chains." },
          { role: "user", content: `Context:\n${graphContext}\n\nQuestion: ${sample.question}` },
        ],
        temperature: 0, maxTokens: 128,
      });
      const graphLat = Date.now() - graphStart;

      const bF1 = computeF1(baseResp.content, sample.answer);
      const gF1 = computeF1(graphResp.content, sample.answer);
      const bEM = computeEM(baseResp.content, sample.answer);
      const gEM = computeEM(graphResp.content, sample.answer);
      const gTokens = entityResp.totalTokens + graphResp.totalTokens;
      const gCost = entityResp.costUsd + graphResp.costUsd;

      results.push({
        idx: i, query: sample.question, gold: sample.answer, type: sample.type,
        baseline_answer: baseResp.content, graphrag_answer: graphResp.content,
        baseline_f1: +bF1.toFixed(4), graphrag_f1: +gF1.toFixed(4),
        baseline_em: bEM, graphrag_em: gEM,
        baseline_tokens: baseResp.totalTokens, graphrag_tokens: gTokens,
        baseline_cost: baseResp.costUsd, graphrag_cost: gCost,
        baseline_latency: baseLat, graphrag_latency: graphLat,
      });

      totalBaselineF1 += bF1; totalGraphragF1 += gF1;
      totalBaselineEM += bEM; totalGraphragEM += gEM;
      totalBaselineTokens += baseResp.totalTokens; totalGraphragTokens += gTokens;
      totalBaselineCost += baseResp.costUsd; totalGraphragCost += gCost;
      totalBaselineLatency += baseLat; totalGraphragLatency += graphLat;
      if (sample.type === "bridge") { bridgeCount++; bridgeBaseF1 += bF1; bridgeGraphF1 += gF1; }
      else { compCount++; compBaseF1 += bF1; compGraphF1 += gF1; }
    } catch (err) {
      console.error(`Benchmark query ${i} failed:`, err);
    }
  }

  const n = results.length || 1;
  const winRate = results.filter(r => (r.graphrag_f1 as number) > (r.baseline_f1 as number)).length / n;

  return NextResponse.json({
    results,
    aggregate: {
      numSamples: results.length,
      baseline: {
        avgF1: +(totalBaselineF1 / n).toFixed(4),
        avgEM: +(totalBaselineEM / n).toFixed(4),
        avgTokens: Math.round(totalBaselineTokens / n),
        avgCost: +(totalBaselineCost / n).toFixed(6),
        avgLatency: Math.round(totalBaselineLatency / n),
      },
      graphrag: {
        avgF1: +(totalGraphragF1 / n).toFixed(4),
        avgEM: +(totalGraphragEM / n).toFixed(4),
        avgTokens: Math.round(totalGraphragTokens / n),
        avgCost: +(totalGraphragCost / n).toFixed(6),
        avgLatency: Math.round(totalGraphragLatency / n),
      },
      graphragF1WinRate: +winRate.toFixed(4),
      byType: {
        bridge: bridgeCount > 0 ? { count: bridgeCount, baselineF1: +(bridgeBaseF1/bridgeCount).toFixed(4), graphragF1: +(bridgeGraphF1/bridgeCount).toFixed(4) } : null,
        comparison: compCount > 0 ? { count: compCount, baselineF1: +(compBaseF1/compCount).toFixed(4), graphragF1: +(compGraphF1/compCount).toFixed(4) } : null,
      },
    },
    provider, model: model || PROVIDERS[provider]?.defaultModel,
    demoMode: !hasKey,
  });
}
