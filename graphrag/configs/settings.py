"""Configuration settings for the GraphRAG Inference Hackathon."""
import os
from dataclasses import dataclass

@dataclass
class AppConfig:
    """Top-level application config."""
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    embed_model: str = os.getenv("EMBED_MODEL", "text-embedding-3-small")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    tg_host: str = os.getenv("TG_HOST", "")
    tg_graph: str = os.getenv("TG_GRAPH", "GraphRAG")
    tg_username: str = os.getenv("TG_USERNAME", "tigergraph")
    tg_password: str = os.getenv("TG_PASSWORD", "")
    dashboard_port: int = 7860
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"

config = AppConfig()
