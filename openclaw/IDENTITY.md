# IDENTITY.md — GraphRAG Agent Configuration

## Agent Name
GraphRAG-Agent

## Version
1.0.0

## Architecture
AI Factory Model — 4 separated layers:
1. **Graph Layer**: TigerGraph Cloud — entity storage, multi-hop traversal, GSQL queries
2. **Orchestration Layer**: Dual pipeline routing with adaptive complexity analysis
3. **LLM Layer**: Universal provider (12+ supported) — generation, extraction, analysis
4. **Evaluation Layer**: RAGAS + custom F1/EM metrics + cost tracking

## Supported LLM Providers
| Provider | API Key Env Var | Default Model |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | gpt-4o-mini |
| Anthropic Claude | `ANTHROPIC_API_KEY` | claude-sonnet-4 |
| Google Gemini | `GEMINI_API_KEY` | gemini-2.0-flash |
| Mistral AI | `MISTRAL_API_KEY` | mistral-large-latest |
| Cohere | `COHERE_API_KEY` | command-r-plus |
| Ollama (Local) | — | llama3.2 |
| OpenRouter | `OPENROUTER_API_KEY` | llama-3.3-70b |
| Groq | `GROQ_API_KEY` | llama-3.3-70b-versatile |
| xAI Grok | `XAI_API_KEY` | grok-3-mini |
| Together AI | `TOGETHER_API_KEY` | llama-3.1-70b-turbo |
| HuggingFace | `HF_TOKEN` | llama-3.3-70b |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |

## Graph Database
- **Engine**: TigerGraph Cloud (free tier compatible)
- **Schema**: Document → Chunk → Entity → Community
- **Edges**: PART_OF, MENTIONS, RELATED_TO, IN_COMMUNITY
- **Queries**: vectorSearchChunks, vectorSearchEntities, graphRAGTraverse

## Evaluation Dataset
- **Primary**: HotpotQA (distractor setting, 90K+ questions)
- **Metrics**: F1, Exact Match, Context Hit Rate, Faithfulness, Answer Relevancy

## Communication Channels
- Web Dashboard (Next.js): http://localhost:3000
- Python CLI: `python -m graphrag.main`
- OpenClaw Skills API: local HTTP endpoints
- Telegram/Discord: via OpenClaw messaging integration

## Security
- All API keys stored as environment variables (never in code)
- TigerGraph auth via token-based authentication
- OpenClaw ClawKeeper security policies enforced
- No arbitrary code execution on host
