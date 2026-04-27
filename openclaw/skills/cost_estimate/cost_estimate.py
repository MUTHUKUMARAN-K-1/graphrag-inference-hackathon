#!/usr/bin/env python3
"""
OpenClaw Skill: cost_estimate
Estimate costs across all 12 LLM providers.
"""
import json
import sys

PROVIDERS = {
    "openai": {"name": "OpenAI GPT-4o-mini", "input": 0.00015, "output": 0.0006},
    "anthropic": {"name": "Claude Sonnet 4", "input": 0.003, "output": 0.015},
    "gemini": {"name": "Gemini 2.0 Flash", "input": 0.0001, "output": 0.0004},
    "mistral": {"name": "Mistral Large", "input": 0.002, "output": 0.006},
    "cohere": {"name": "Command R+", "input": 0.0025, "output": 0.01},
    "ollama": {"name": "Llama 3.2 (Local)", "input": 0, "output": 0},
    "openrouter": {"name": "Llama 3.3 70B", "input": 0.0004, "output": 0.0004},
    "groq": {"name": "Llama 3.3 70B (LPU)", "input": 0.00059, "output": 0.00079},
    "xai": {"name": "Grok 3 Mini", "input": 0.0003, "output": 0.0005},
    "together": {"name": "Llama 3.1 70B Turbo", "input": 0.00088, "output": 0.00088},
    "huggingface": {"name": "Llama 3.3 70B (HF)", "input": 0, "output": 0},
    "deepseek": {"name": "DeepSeek V3", "input": 0.00014, "output": 0.00028},
}

BASELINE_INPUT_TOKENS = 800
BASELINE_OUTPUT_TOKENS = 150
GRAPHRAG_INPUT_TOKENS = 2200
GRAPHRAG_OUTPUT_TOKENS = 200


def cost_estimate(num_queries: int, provider: str = None) -> dict:
    providers = {provider: PROVIDERS[provider]} if provider and provider in PROVIDERS else PROVIDERS
    results = []

    for pid, p in providers.items():
        baseline_cost = (BASELINE_INPUT_TOKENS / 1000 * p["input"] +
                         BASELINE_OUTPUT_TOKENS / 1000 * p["output"])
        graphrag_cost = (GRAPHRAG_INPUT_TOKENS / 1000 * p["input"] +
                         GRAPHRAG_OUTPUT_TOKENS / 1000 * p["output"])
        results.append({
            "provider": pid,
            "name": p["name"],
            "baseline_cost_per_query": round(baseline_cost, 8),
            "graphrag_cost_per_query": round(graphrag_cost, 8),
            "baseline_total": round(baseline_cost * num_queries, 4),
            "graphrag_total": round(graphrag_cost * num_queries, 4),
            "monthly_1k_qpd": round(graphrag_cost * 1000 * 30, 2),
            "annual_1k_qpd": round(graphrag_cost * 1000 * 365, 2),
            "is_free": p["input"] == 0 and p["output"] == 0,
        })

    results.sort(key=lambda x: x["graphrag_total"])

    return {
        "num_queries": num_queries,
        "providers": results,
        "cheapest": results[0]["provider"],
        "most_expensive": results[-1]["provider"] if results else None,
    }


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
    p = sys.argv[2] if len(sys.argv) > 2 else None
    print(json.dumps(cost_estimate(n, p), indent=2))
