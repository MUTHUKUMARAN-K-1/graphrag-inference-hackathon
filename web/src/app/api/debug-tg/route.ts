import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tgHost = (process.env.TG_HOST || "").replace(/\/$/, "");
  const secret = process.env.TG_SECRET;
  const hfToken = process.env.HUGGING_FACE_HUB_TOKEN || process.env.HF_TOKEN;

  const info: Record<string, unknown> = {
    TG_HOST_set: !!tgHost,
    TG_HOST_prefix: tgHost.slice(0, 40) || "(empty)",
    TG_SECRET_set: !!secret,
    HF_TOKEN_set: !!hfToken,
    GROQ_API_KEY_set: !!process.env.GROQ_API_KEY,
  };

  // Test HF embedding
  try {
    const res = await fetch(
      "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${hfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: "general relativity" }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const data = await res.json();
    const flat = Array.isArray(data[0]) ? data[0] : data;
    info.hf_embedding_ok = res.ok;
    info.hf_embedding_dims = Array.isArray(flat) ? flat.length : "not-array";
    info.hf_status = res.status;
  } catch (e) {
    info.hf_embedding_ok = false;
    info.hf_error = String(e);
  }

  // Test TigerGraph connection
  if (tgHost && secret) {
    try {
      const authHeader = `GSQL-Secret ${secret}`;
      const res = await fetch(`${tgHost}/restpp/query/GraphRAG/vectorSearchChunks`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ queryVec: new Array(384).fill(0.01), topK: 2 }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      info.tg_status = res.status;
      info.tg_ok = res.ok;
      info.tg_error_field = data.error;
      info.tg_message = data.message?.slice(0, 100);
      info.tg_chunks_returned = data.results?.[0]?.["@@topChunks"]?.length ?? 0;
    } catch (e) {
      info.tg_ok = false;
      info.tg_error = String(e);
    }
  } else {
    info.tg_skipped = "TG_HOST or TG_SECRET missing";
  }

  return NextResponse.json(info);
}
