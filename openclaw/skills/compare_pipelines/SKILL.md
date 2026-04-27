# compare_pipelines

Run a query through both Baseline RAG and GraphRAG pipelines simultaneously, then compare their answers side-by-side with metrics including tokens, latency, cost, and answer quality.

## Parameters
- `query` (string, required): Question to compare across pipelines
- `provider` (string, optional, default="anthropic"): LLM provider to use
- `model` (string, optional): Specific model ID (defaults to provider's default)

## Returns
JSON with:
- `baseline`: Answer, tokens, latency, cost from Pipeline A (Baseline RAG)
- `graphrag`: Answer, tokens, latency, cost, entities, relations from Pipeline B (GraphRAG)
- `complexity`: Query complexity score (0.0-1.0)
- `recommended`: Which pipeline the adaptive router recommends

## Example
```
compare_pipelines "Which magazine was started first?" --provider ollama --model llama3.2
```
