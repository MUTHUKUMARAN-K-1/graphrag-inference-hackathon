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
      "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: text }),
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
  const secret = process.env.TG_SECRET;
  const token = process.env.TG_TOKEN;
  const graph = process.env.TG_GRAPH || "GraphRAG";
  // Prefer GSQL-Secret (doesn't expire) over Bearer token
  const authHeader = secret ? `GSQL-Secret ${secret}` : token ? `Bearer ${token}` : null;
  if (!host || !authHeader || !embedding.length) return [];
  try {
    const res = await fetch(`${host}/restpp/query/${graph}/vectorSearchChunks`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
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

/** Extract compact entity descriptions from chunk text in "EntityName: description" format.
 *  Wikipedia articles open with "X is/are Y" — we extract X as the entity name so the
 *  knowledge-graph context is always structured as "ConceptName: first sentence". */
export function chunkToEntityContext(text: string, maxChars = 220): string {
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0].trim();
  // Match "EntityName is/are/was/were ..." Wikipedia opening pattern
  const match = firstSentence.match(/^([A-Z][^.]{2,55}?)\s+(?:is|are|was|were)\s+/);
  if (match) {
    // Strip parentheticals like "(DNA)" so entity name stays clean
    const entityName = match[1].replace(/\s*\([^)]+\)/g, "").trim();
    return `${entityName}: ${firstSentence.slice(0, maxChars)}`;
  }
  return firstSentence.slice(0, maxChars);
}

/** Rough token count estimate (1 token ≈ 0.75 words) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.33);
}

export interface TGDocChunk {
  idx: number;
  chunk_id: string;
  text: string;
}

/** Multi-hop: fetch sibling chunks from the same document as seedChunkId.
 *  Walks Chunk→PART_OF→Document→Chunks via the getDocumentChunks GSQL query. */
export async function getDocumentChunks(chunkId: string, topK = 6): Promise<TGDocChunk[]> {
  const tgHost = (process.env.TG_HOST || "").replace(/\/$/, "");
  const secret = process.env.TG_SECRET;
  const token = process.env.TG_TOKEN;
  const graph = process.env.TG_GRAPH || "GraphRAG";
  const authHeader = secret ? `GSQL-Secret ${secret}` : token ? `Bearer ${token}` : null;
  if (!tgHost || !authHeader) return [];
  try {
    const res = await fetch(`${tgHost}/restpp/query/${graph}/getDocumentChunks`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ seedChunkId: chunkId, topK }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = (data.results?.[0]?.["@@rows"] as TGDocChunk[]) || [];
    return rows.sort((a, b) => a.idx - b.idx).slice(0, topK);
  } catch {
    return [];
  }
}

export interface TGEntityChunk {
  chunk_id: string;
  text: string;
}

/** Relationship awareness: real entity-hop traversal via MENTIONS and RELATED_TO edges.
 *  Chunk→MENTIONS→Entity→RELATED_TO→Entity→MENTIONS(reverse)→Chunks */
export async function getEntityHopChunks(chunkId: string, topK = 4): Promise<TGEntityChunk[]> {
  const tgHost = (process.env.TG_HOST || "").replace(/\/$/, "");
  const secret = process.env.TG_SECRET;
  const token = process.env.TG_TOKEN;
  const graph = process.env.TG_GRAPH || "GraphRAG";
  const authHeader = secret ? `GSQL-Secret ${secret}` : token ? `Bearer ${token}` : null;
  if (!tgHost || !authHeader) return [];
  try {
    const res = await fetch(`${tgHost}/restpp/query/${graph}/entityHopChunks`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ seedChunkId: chunkId, topK }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results?.[0]?.["@@results"] as TGEntityChunk[]) || [];
  } catch {
    return [];
  }
}

/** Fallback entity extraction for when entity graph has no data for a chunk.
 *  Extracts capitalized concept names to seed a secondary vector search. */
export function extractEntityNames(text: string, max = 3): string[] {
  const matches = text.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g) || [];
  return [...new Set(matches)].slice(0, max);
}
