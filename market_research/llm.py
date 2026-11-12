"""Optional LLM (Groq, free tier, OpenAI-compatible API).

The key is read from the GROQ_API_KEY environment variable (never stored in code). Without a key every
agent still runs: numbers come from SQL and the text uses templates.
"""
from __future__ import annotations

import os
import time

import requests

URL = "https://api.groq.com/openai/v1/chat/completions"
MODELS_URL = "https://api.groq.com/openai/v1/models"
# Preferred models, best first. Groq retires models over time, so the one actually used is picked from the
# models the account can access right now (or set GROQ_MODEL to force one).
PREFERRED = ["openai/gpt-oss-120b", "llama-3.3-70b", "llama-4-maverick", "qwen3-32b", "llama-4-scout",
             "openai/gpt-oss-20b", "llama-3.1-8b"]
NOT_CHAT = ("whisper", "guard", "tts", "playai", "orpheus", "distil", "compound", "prompt")
MODEL = os.getenv("GROQ_MODEL", "")


def pick_model(available: list[str]) -> str | None:
    chat = [m for m in available if not any(x in m.lower() for x in NOT_CHAT)]
    for want in PREFERRED:
        for m in chat:
            if want in m.lower():
                return m
    return chat[0] if chat else None


def model() -> str:
    """The model to use: GROQ_MODEL if set, otherwise the best one the account has access to."""
    global MODEL
    if MODEL:
        return MODEL
    r = requests.get(MODELS_URL, timeout=30, headers={"Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}"})
    if not r.ok:
        raise RuntimeError(f"Groq HTTP {r.status_code} listing models")
    MODEL = pick_model([m["id"] for m in r.json().get("data", []) if m.get("active", True)]) or ""
    if not MODEL:
        raise RuntimeError("No Groq chat model available")
    return MODEL


def available() -> bool:
    return bool(os.getenv("GROQ_API_KEY"))


def chat(messages: list[dict], max_tokens: int = 400, temperature: float = 0.3, retries: int = 3) -> str:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set")
    for attempt in range(retries):
        r = requests.post(URL, timeout=60, headers={"Authorization": f"Bearer {key}"},
                          json={"model": model(), "messages": messages, "max_tokens": max_tokens,
                                "temperature": temperature})
        if r.status_code == 429 and attempt < retries - 1:  # free-tier rate limit: wait and retry
            time.sleep(float(r.headers.get("retry-after", 5 * (attempt + 1))))
            continue
        if not r.ok:  # report Groq's own error message (never the key)
            try:
                msg = r.json().get("error", {}).get("message", "")
            except ValueError:
                msg = r.text[:120]
            raise RuntimeError(f"Groq HTTP {r.status_code}: {msg[:160]}")
        return r.json()["choices"][0]["message"]["content"].strip()
    raise RuntimeError("Groq rate limit")
