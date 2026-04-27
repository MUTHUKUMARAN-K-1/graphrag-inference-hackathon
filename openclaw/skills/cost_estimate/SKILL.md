# cost_estimate

Estimate the cost of running queries through different LLM providers and models. Supports all 12 providers: OpenAI, Claude, Gemini, Mistral, Cohere, Ollama (free), OpenRouter, Groq, xAI, Together, HuggingFace, DeepSeek.

## Parameters
- `num_queries` (integer, required): Number of queries to project
- `provider` (string, optional): Specific provider to analyze (default: all)
- `pipeline` (string, optional): "baseline", "graphrag", or "both" (default: both)

## Returns
JSON with cost projections per provider including:
- Cost per query for baseline and graphrag pipelines
- Total cost for the specified number of queries
- Monthly and annual projections at 1K queries/day
- Provider comparison sorted by total cost

## Example
```
cost_estimate 10000 --provider ollama --pipeline both
```

---

# benchmark

Run the HotpotQA benchmark suite through both pipelines and generate a full evaluation report with F1, Exact Match, Context Hit Rate, and cost analysis.

## Parameters
- `num_samples` (integer, optional, default=50): Number of HotpotQA questions to evaluate
- `provider` (string, optional, default="anthropic"): LLM provider
- `model` (string, optional): Specific model ID
- `output` (string, optional): File path to save results JSON

## Returns
JSON with:
- Per-query results with F1, EM, tokens, cost for both pipelines
- Aggregate metrics (avg F1, avg EM, context hit rate, win rate)
- Stratified results by question type (bridge vs comparison)
- Full text benchmark report

## Example
```
benchmark 100 --provider openai --model gpt-4o-mini --output results.json
```
