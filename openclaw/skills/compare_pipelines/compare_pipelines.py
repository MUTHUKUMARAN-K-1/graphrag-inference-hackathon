#!/usr/bin/env python3
"""
OpenClaw Skill: compare_pipelines
Run dual-pipeline comparison and return structured results.
"""
import json
import os
import sys
import requests

API_BASE = os.getenv("GRAPHRAG_API_BASE", "http://localhost:3000")


def compare_pipelines(query: str, provider: str = "anthropic", model: str = None) -> dict:
    """Compare Baseline RAG vs GraphRAG on a query."""
    try:
        payload = {"query": query, "adaptiveRouting": True}
        if provider:
            payload["provider"] = provider
        if model:
            payload["model"] = model

        response = requests.post(f"{API_BASE}/api/compare", json=payload, timeout=120)
        response.raise_for_status()
        data = response.json()

        b = data.get("baseline", {})
        g = data.get("graphrag", {})

        return {
            "query": query,
            "baseline": {
                "answer": b.get("answer", ""),
                "tokens": b.get("tokens", 0),
                "latency_ms": b.get("latencyMs", 0),
                "cost_usd": b.get("costUsd", 0),
            },
            "graphrag": {
                "answer": g.get("answer", ""),
                "tokens": g.get("tokens", 0),
                "latency_ms": g.get("latencyMs", 0),
                "cost_usd": g.get("costUsd", 0),
                "entities_found": len(g.get("entities", [])),
                "relations_found": len(g.get("relations", [])),
            },
            "complexity": data.get("complexity", 0),
            "query_type": data.get("queryType", "unknown"),
            "recommended": data.get("recommended", "baseline"),
            "token_ratio": g.get("tokens", 1) / max(b.get("tokens", 1), 1),
        }
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "What is the capital of France?"
    provider = sys.argv[2] if len(sys.argv) > 2 else "anthropic"
    result = compare_pipelines(query, provider)
    print(json.dumps(result, indent=2))
