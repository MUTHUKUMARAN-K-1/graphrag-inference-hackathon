#!/usr/bin/env python3
"""
OpenClaw Skill: graph_query
Query the TigerGraph knowledge graph using natural language.
"""
import json
import os
import sys
import requests

API_BASE = os.getenv("GRAPHRAG_API_BASE", "http://localhost:3000")


def graph_query(query: str, depth: int = 2, top_k: int = 5) -> dict:
    """Query the knowledge graph via the GraphRAG API."""
    try:
        response = requests.post(
            f"{API_BASE}/api/compare",
            json={
                "query": query,
                "adaptiveRouting": True,
                "hops": depth,
                "topK": top_k,
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()

        return {
            "query": query,
            "entities": data.get("graphrag", {}).get("entities", []),
            "relations": data.get("graphrag", {}).get("relations", []),
            "answer": data.get("graphrag", {}).get("answer", ""),
            "tokens_used": data.get("graphrag", {}).get("tokens", 0),
            "cost_usd": data.get("graphrag", {}).get("costUsd", 0),
            "complexity": data.get("complexity", 0),
            "query_type": data.get("queryType", "unknown"),
            "recommended_pipeline": data.get("recommended", ""),
        }
    except requests.exceptions.ConnectionError:
        return {"error": f"Cannot connect to GraphRAG API at {API_BASE}. Is the server running?"}
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "What is GraphRAG?"
    result = graph_query(query)
    print(json.dumps(result, indent=2))
