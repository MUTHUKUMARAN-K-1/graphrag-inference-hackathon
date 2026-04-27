import { NextResponse } from "next/server";
import { getProviderDisplayInfo, checkOllamaHealth } from "@/lib/llm-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const providers = getProviderDisplayInfo();
  const ollamaStatus = await checkOllamaHealth();

  // Update Ollama entry with live status
  const updated = providers.map((p) => {
    if (p.id === "ollama") {
      return {
        ...p,
        hasApiKey: ollamaStatus.ok,
        ollamaRunning: ollamaStatus.ok,
        ollamaModels: ollamaStatus.models,
      };
    }
    return p;
  });

  return NextResponse.json({
    providers: updated,
    totalProviders: providers.length,
    availableProviders: updated.filter((p) => p.hasApiKey).length,
    ollamaStatus,
  });
}
