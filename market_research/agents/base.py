"""Shared pieces for every agent: findings that carry their own evidence, and a message trace."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

from market_research import llm


@dataclass
class Finding:
    id: str
    text: str            # plain-English sentence shown to the user
    value: float | int | str | None
    sql: str | None = None   # the query that produced `value`: the fact-checker re-runs it
    unit: str = ""


@dataclass
class Report:
    agent: str
    role: str
    summary: str
    findings: list[Finding] = field(default_factory=list)
    data: dict = field(default_factory=dict)
    written_by: str = "template"  # "template" or "llm"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["findings"] = [asdict(f) for f in self.findings]
        return d

    def facts(self) -> str:
        return "\n".join(f"- {f.text}" for f in self.findings)


TRACE: list[dict] = []


def say(sender: str, receiver: str, content: str) -> None:
    """Record a message between agents (shown in the app's 'How the agents worked' view)."""
    TRACE.append({"from": sender, "to": receiver, "content": content})


class Agent:
    name = "Agent"
    role = ""
    icon = "🤖"

    def write(self, facts: str, instruction: str, fallback: str, max_tokens: int = 220) -> tuple[str, str]:
        """Let the LLM phrase the facts; fall back to the template text. The fact-checker checks it later."""
        self.last_template = fallback
        if not llm.available():
            return fallback, "template"
        try:
            text = llm.chat([
                {"role": "system", "content": f"You are the {self.name} in a team helping a first-time owner open a "
                 "coffee shop in New York City. Use ONLY the facts given. Do not invent numbers, names or places. "
                 "Write warm, plain English for someone new to business. No markdown headings."},
                {"role": "user", "content": f"Facts:\n{facts}\n\n{instruction}"}], max_tokens=max_tokens)
            return text, "llm"
        except Exception as exc:  # rate limit / network: keep going with the template
            say(self.name, "system", f"LLM unavailable ({str(exc)[:200] or exc.__class__.__name__}); used the template text.")
            return fallback, "template"
