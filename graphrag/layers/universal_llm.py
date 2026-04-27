"""
Universal LLM Layer — LiteLLM-powered multi-provider support
=============================================================
Supports 12 providers through a single interface:
OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama (local),
OpenRouter, Groq, xAI, Together AI, HuggingFace, DeepSeek

Uses LiteLLM for unified API, falls back to direct OpenAI SDK
if LiteLLM is not installed.
"""
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Provider Registry ─────────────────────────────────

PROVIDERS = {
    "openai": {
        "name": "OpenAI",
        "litellm_prefix": "openai",
        "default_model": "gpt-4o-mini",
        "api_key_env": "OPENAI_API_KEY",
        "cost_input": 0.00015, "cost_output": 0.0006,
    },
    "anthropic": {
        "name": "Anthropic Claude",
        "litellm_prefix": "anthropic",
        "default_model": "claude-sonnet-4-20250514",
        "api_key_env": "ANTHROPIC_API_KEY",
        "cost_input": 0.003, "cost_output": 0.015,
    },
    "gemini": {
        "name": "Google Gemini",
        "litellm_prefix": "gemini",
        "default_model": "gemini-2.0-flash",
        "api_key_env": "GEMINI_API_KEY",
        "cost_input": 0.0001, "cost_output": 0.0004,
    },
    "mistral": {
        "name": "Mistral AI",
        "litellm_prefix": "mistral",
        "default_model": "mistral-large-latest",
        "api_key_env": "MISTRAL_API_KEY",
        "cost_input": 0.002, "cost_output": 0.006,
    },
    "cohere": {
        "name": "Cohere",
        "litellm_prefix": "cohere_chat",
        "default_model": "command-r-plus",
        "api_key_env": "COHERE_API_KEY",
        "cost_input": 0.0025, "cost_output": 0.01,
    },
    "ollama": {
        "name": "Ollama (Local)",
        "litellm_prefix": "ollama_chat",
        "default_model": "llama3.2",
        "api_key_env": "",
        "api_base": "http://localhost:11434",
        "cost_input": 0, "cost_output": 0,
        "is_local": True,
    },
    "openrouter": {
        "name": "OpenRouter",
        "litellm_prefix": "openrouter",
        "default_model": "meta-llama/llama-3.3-70b-instruct",
        "api_key_env": "OPENROUTER_API_KEY",
        "cost_input": 0.0004, "cost_output": 0.0004,
    },
    "groq": {
        "name": "Groq",
        "litellm_prefix": "groq",
        "default_model": "llama-3.3-70b-versatile",
        "api_key_env": "GROQ_API_KEY",
        "cost_input": 0.00059, "cost_output": 0.00079,
    },
    "xai": {
        "name": "xAI Grok",
        "litellm_prefix": "xai",
        "default_model": "grok-3-mini",
        "api_key_env": "XAI_API_KEY",
        "cost_input": 0.0003, "cost_output": 0.0005,
    },
    "together": {
        "name": "Together AI",
        "litellm_prefix": "together_ai",
        "default_model": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        "api_key_env": "TOGETHER_API_KEY",
        "cost_input": 0.00088, "cost_output": 0.00088,
    },
    "huggingface": {
        "name": "HuggingFace Inference",
        "litellm_prefix": "huggingface",
        "default_model": "meta-llama/Llama-3.3-70B-Instruct",
        "api_key_env": "HF_TOKEN",
        "cost_input": 0, "cost_output": 0,
    },
    "deepseek": {
        "name": "DeepSeek",
        "litellm_prefix": "deepseek",
        "default_model": "deepseek-chat",
        "api_key_env": "DEEPSEEK_API_KEY",
        "cost_input": 0.00014, "cost_output": 0.00028,
    },
}


@dataclass
class LLMResponse:
    """Universal LLM response."""
    content: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    model: str = ""
    provider: str = ""


class UniversalLLM:
    """
    Universal LLM client supporting 12 providers.
    Uses LiteLLM when available, falls back to OpenAI SDK.
    """

    def __init__(self, provider: str = "openai", model: str = None,
                 api_key: str = None, api_base: str = None):
        self.provider_id = provider
        self.provider_config = PROVIDERS.get(provider, PROVIDERS["openai"])
        self.model = model or self.provider_config["default_model"]
        self._api_key = api_key
        self._api_base = api_base
        self._litellm = None
        self._openai_client = None
        self._anthropic_client = None

    def initialize(self):
        """Initialize the appropriate SDK."""
        # Try LiteLLM first (universal)
        try:
            import litellm
            self._litellm = litellm
            litellm.drop_params = True  # auto-drop unsupported params
            logger.info(f"LiteLLM initialized for {self.provider_id}/{self.model}")
            return
        except ImportError:
            pass

        # Fall back to direct SDK
        if self.provider_id == "anthropic":
            try:
                from anthropic import Anthropic
                key = self._api_key or os.getenv(self.provider_config["api_key_env"], "")
                self._anthropic_client = Anthropic(api_key=key)
                logger.info(f"Anthropic SDK initialized: {self.model}")
                return
            except ImportError:
                pass

        # OpenAI SDK (works for OpenAI, Ollama, Groq, Together, etc.)
        try:
            from openai import OpenAI
            api_key_env = self.provider_config.get("api_key_env", "")
            key = self._api_key or os.getenv(api_key_env, "") or "ollama"
            base = self._api_base or self.provider_config.get("api_base", "")

            base_urls = {
                "openai": "https://api.openai.com/v1",
                "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
                "mistral": "https://api.mistral.ai/v1",
                "cohere": "https://api.cohere.ai/compatibility/v1",
                "ollama": "http://localhost:11434/v1",
                "openrouter": "https://openrouter.ai/api/v1",
                "groq": "https://api.groq.com/openai/v1",
                "xai": "https://api.x.ai/v1",
                "together": "https://api.together.xyz/v1",
                "huggingface": "https://api-inference.huggingface.co/v1",
                "deepseek": "https://api.deepseek.com/v1",
            }
            base_url = base or base_urls.get(self.provider_id, "https://api.openai.com/v1")

            self._openai_client = OpenAI(base_url=base_url, api_key=key)
            logger.info(f"OpenAI-compat SDK initialized for {self.provider_id}: {base_url}")
        except ImportError:
            logger.warning("No SDK available. Install: pip install openai litellm anthropic")

    def generate(self, messages: List[Dict[str, str]],
                 temperature: float = 0, max_tokens: int = 1024,
                 json_mode: bool = False) -> LLMResponse:
        """Generate a response using the configured provider."""
        start = time.perf_counter()
        cost_in = self.provider_config.get("cost_input", 0)
        cost_out = self.provider_config.get("cost_output", 0)

        # ── LiteLLM path ──────────────────────────────
        if self._litellm:
            return self._call_litellm(messages, temperature, max_tokens, json_mode, start, cost_in, cost_out)

        # ── Anthropic direct path ─────────────────────
        if self._anthropic_client:
            return self._call_anthropic(messages, temperature, max_tokens, start, cost_in, cost_out)

        # ── OpenAI-compat path ────────────────────────
        if self._openai_client:
            return self._call_openai(messages, temperature, max_tokens, json_mode, start, cost_in, cost_out)

        # ── Mock fallback ─────────────────────────────
        return LLMResponse(
            content="[No LLM SDK available. Install: pip install openai]",
            input_tokens=50, output_tokens=20, total_tokens=70,
            latency_ms=100, cost_usd=0, model=self.model, provider=self.provider_id,
        )

    def _call_litellm(self, messages, temp, max_tok, json_mode, start, ci, co):
        prefix = self.provider_config["litellm_prefix"]
        model_str = f"{prefix}/{self.model}"
        kwargs = {"model": model_str, "messages": messages,
                  "temperature": temp, "max_tokens": max_tok}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        if self.provider_config.get("api_base"):
            kwargs["api_base"] = self.provider_config["api_base"]

        resp = self._litellm.completion(**kwargs)
        elapsed = (time.perf_counter() - start) * 1000
        u = resp.usage
        return LLMResponse(
            content=resp.choices[0].message.content or "",
            input_tokens=u.prompt_tokens, output_tokens=u.completion_tokens,
            total_tokens=u.total_tokens, latency_ms=elapsed,
            cost_usd=(u.prompt_tokens / 1000 * ci + u.completion_tokens / 1000 * co),
            model=self.model, provider=self.provider_id,
        )

    def _call_anthropic(self, messages, temp, max_tok, start, ci, co):
        sys_msg = next((m["content"] for m in messages if m["role"] == "system"), None)
        user_msgs = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]
        kwargs = {"model": self.model, "max_tokens": max_tok,
                  "temperature": temp, "messages": user_msgs}
        if sys_msg:
            kwargs["system"] = sys_msg
        msg = self._anthropic_client.messages.create(**kwargs)
        elapsed = (time.perf_counter() - start) * 1000
        content = msg.content[0].text if msg.content and msg.content[0].type == "text" else ""
        return LLMResponse(
            content=content,
            input_tokens=msg.usage.input_tokens, output_tokens=msg.usage.output_tokens,
            total_tokens=msg.usage.input_tokens + msg.usage.output_tokens,
            latency_ms=elapsed,
            cost_usd=(msg.usage.input_tokens / 1000 * ci + msg.usage.output_tokens / 1000 * co),
            model=self.model, provider=self.provider_id,
        )

    def _call_openai(self, messages, temp, max_tok, json_mode, start, ci, co):
        kwargs = {"model": self.model, "messages": messages,
                  "temperature": temp, "max_tokens": max_tok}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = self._openai_client.chat.completions.create(**kwargs)
        elapsed = (time.perf_counter() - start) * 1000
        u = resp.usage
        return LLMResponse(
            content=resp.choices[0].message.content or "",
            input_tokens=u.prompt_tokens if u else 0,
            output_tokens=u.completion_tokens if u else 0,
            total_tokens=u.total_tokens if u else 0, latency_ms=elapsed,
            cost_usd=((u.prompt_tokens if u else 0) / 1000 * ci + (u.completion_tokens if u else 0) / 1000 * co),
            model=self.model, provider=self.provider_id,
        )

    # ── Convenience methods ──────────────────────────

    def generate_answer(self, query, context, system_prompt=None):
        if not system_prompt:
            system_prompt = "Answer accurately using ONLY the provided context. Be concise."
        return self.generate([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}\n\nAnswer:"},
        ], max_tokens=512)

    def extract_entities(self, text):
        return self.generate([
            {"role": "system", "content": 'Extract entities and relationships. Return JSON: {"entities": [{"name": "...", "type": "PERSON|ORG|LOCATION|EVENT|CONCEPT"}], "relations": [{"source": "...", "target": "...", "type": "...", "description": "..."}]}'},
            {"role": "user", "content": text},
        ], max_tokens=2048, json_mode=True)

    def extract_keywords(self, query):
        return self.generate([
            {"role": "system", "content": 'Extract keywords. Return JSON: {"high_level": ["themes"], "low_level": ["entities"]}'},
            {"role": "user", "content": query},
        ], max_tokens=256, json_mode=True)


def get_available_providers() -> List[str]:
    """Return list of provider IDs with valid API keys."""
    available = []
    for pid, cfg in PROVIDERS.items():
        if cfg.get("is_local"):
            available.append(pid)
        elif not cfg.get("api_key_env"):
            available.append(pid)
        elif os.getenv(cfg["api_key_env"]):
            available.append(pid)
    return available


def check_ollama() -> Dict[str, Any]:
    """Check if Ollama is running locally."""
    import urllib.request
    try:
        req = urllib.request.Request("http://localhost:11434/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read())
            return {"ok": True, "models": [m["name"] for m in data.get("models", [])]}
    except Exception:
        return {"ok": False, "models": []}
