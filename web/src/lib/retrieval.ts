/**
 * Retrieval utilities: HuggingFace embeddings + TigerGraph vector search
 */

export interface TGChunk {
  chunk_id: string;
  text: string;
  score: number;
}

// In-process embedding cache — avoids re-hitting HF API for the same query text.
// Capped at 256 entries to prevent unbounded memory growth in long-running servers.
const embeddingCache = new Map<string, number[]>();
const EMBED_CACHE_MAX = 256;

/** Generate 384-dim embedding via HF Inference API (all-MiniLM-L6-v2) */
export async function getEmbedding(text: string): Promise<number[] | null> {
  const normalized = text.trim().toLowerCase();
  const cached = embeddingCache.get(normalized);
  if (cached) return cached;

  const token = process.env.HUGGING_FACE_HUB_TOKEN || process.env.HF_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    // Handle both [0.1, 0.2, ...] and [[0.1, 0.2, ...]]
    const flat: number[] = Array.isArray(data[0]) ? (data[0] as number[]) : (data as number[]);
    if (!flat.every((x) => typeof x === "number")) return null;

    if (embeddingCache.size >= EMBED_CACHE_MAX) {
      embeddingCache.delete(embeddingCache.keys().next().value!);
    }
    embeddingCache.set(normalized, flat);
    return flat;
  } catch {
    return null;
  }
}

/** Call TigerGraph vectorSearchChunks installed query */
export async function searchChunks(embedding: number[], topK = 5): Promise<TGChunk[]> {
  const host = (process.env.TG_HOST || "").replace(/\/$/, "");
  const token = process.env.TG_TOKEN;
  const graph = process.env.TG_GRAPH || "GraphRAG";
  if (!host || !token || !embedding.length) return [];
  try {
    const res = await fetch(`${host}/restpp/query/${graph}/vectorSearchChunks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ queryVec: embedding, topK }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results?.[0]?.["@@topChunks"] as TGChunk[]) || [];
  } catch {
    return [];
  }
}

/** Extract compact entity descriptions from chunk text (simulates pre-indexed graph data).
 *  Entity extraction runs at INGEST TIME so the cost is amortized.
 *  At query time, we only pay for the compact entity context, not full chunk text. */
export function chunkToEntityContext(text: string, maxChars = 220): string {
  // Take first sentence — Wikipedia science articles open with the key entity definition
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0].trim();
  return firstSentence.slice(0, maxChars);
}

/** Rough token count estimate (1 token ≈ 0.75 words) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.33);
}
