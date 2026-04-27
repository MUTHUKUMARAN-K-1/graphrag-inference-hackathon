# graph_query

Query the TigerGraph knowledge graph using natural language. Performs dual-level keyword extraction, entity vector search, and multi-hop graph traversal to find relevant entities, relationships, and evidence passages.

## Parameters
- `query` (string, required): Natural language question to search the knowledge graph
- `depth` (integer, optional, default=2): Number of hops for graph traversal (1-4)
- `top_k` (integer, optional, default=5): Number of seed entities to retrieve

## Returns
JSON object with:
- `entities`: List of entities found with names, types, and descriptions
- `relations`: List of relationships traversed with source, target, and type
- `passages`: Relevant text chunks connected to discovered entities
- `reasoning_path`: Step-by-step explanation of the graph traversal

## Example
```
graph_query "Were Scott Derrickson and Ed Wood of the same nationality?" --depth 2
```

## Notes
- Requires TigerGraph connection (set TG_HOST, TG_PASSWORD env vars)
- Falls back to in-memory entity extraction if TigerGraph unavailable
- Uses the configured LLM provider for keyword extraction
