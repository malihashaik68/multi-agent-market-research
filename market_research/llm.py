"""Optional LLM (Groq, free tier, OpenAI-compatible API).

The key is read from the GROQ_API_KEY environment variable (never stored in code). Without a key every
agent still runs: numbers come from SQL and the text uses templates.
"""
from __future__ import annotations

import os
import time

import requests

URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def available() -> bool:
    return bool(os.getenv("GROQ_API_KEY"))


def chat(messages: list[dict], max_tokens: int = 400, temperature: float = 0.3, retries: int = 3) -> str:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set")
    for attempt in range(retries):
        r = requests.post(URL, timeout=60, headers={"Authorization": f"Bearer {key}"},
                          json={"model": MODEL, "messages": messages, "max_tokens": max_tokens,
                                "temperature": temperature})
        if r.status_code == 429 and attempt < retries - 1:  # free-tier rate limit: wait and retry
            time.sleep(float(r.headers.get("retry-after", 5 * (attempt + 1))))
            continue
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    raise RuntimeError("Groq rate limit")
