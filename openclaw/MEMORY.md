# MEMORY.md — GraphRAG Agent Knowledge Base

## Learned Facts

### GraphRAG Performance Characteristics
- GraphRAG achieves +21% F1 improvement over baseline RAG on bridge-type questions (HotpotQA)
- GraphRAG uses ~2.5x more tokens per query than baseline RAG
- Adaptive routing eliminates token overhead for simple queries (complexity < 0.6)
- Schema-bounded extraction reduces entity extraction cost by ~90% vs unconstrained
- Multi-hop traversal (2 hops) is the sweet spot — 3+ hops adds noise without proportional accuracy gain

### Provider Performance Notes
- Claude Sonnet 4: Best at structured entity extraction (JSON mode via tool_use)
- GPT-4o-mini: Best cost/quality ratio for answer generation
- Gemini 2.0 Flash: Fastest response times, good for keyword extraction
- Ollama llama3.2: Acceptable quality for entity extraction, zero cost
- Groq llama-3.3-70b: Near-cloud quality at very low latency (LPU hardware)
- DeepSeek R1: Excellent reasoning quality but slower

### TigerGraph Best Practices
- Batch upsert limit: 10,000 vertices per call on free tier
- GSQL query compilation: 30-120 seconds (install once, run many times)
- Vector search is brute-force cosine similarity on free tier (no HNSW index)
- Entity deduplication via hash(name.lower() + type.lower()) is essential

### HotpotQA Dataset Notes
- Bridge questions: require connecting information across 2 documents
- Comparison questions: require comparing attributes of 2 entities
- Supporting facts: gold standard for context evaluation
- Distractor setting: 8 distractor passages + 2 relevant passages per question

## User Preferences
- Prefer concise answers with explicit evidence
- Show graph reasoning paths for complex queries
- Always display token counts and costs
- Default to adaptive routing enabled
