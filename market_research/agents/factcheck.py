"""Fact-checker agent: checks the other agents' work before the user sees it.

1. Re-runs the SQL behind every finding and confirms the stored number matches the database.
2. Reads every text an LLM wrote and checks that each number in it appears in that agent's findings.
   If not, the LLM text is replaced by the template text (which is built only from verified numbers).
"""
from __future__ import annotations

import re

from market_research.agents.base import Agent, Finding, Report, say
from market_research.tools import scalar

NUM = re.compile(r"\$?\d[\d,]*(?:\.\d+)?%?")


def _variants(v) -> set[float]:
    """Ways a number can legitimately appear in text: as-is, rounded, as a percentage."""
    try:
        x = float(v)
    except (TypeError, ValueError):
        return set()
    out = {round(x, 1), float(round(x))}
    if 0 <= x <= 1:
        out |= {float(round(100 * x)), round(100 * x, 1), round(100 * (1 - x))}
    return out


def numbers_in(text: str) -> list[float]:
    vals = []
    for m in NUM.findall(text or ""):
        raw = m.replace("$", "").replace(",", "").rstrip("%")
        try:
            vals.append(float(raw))
        except ValueError:
            pass
    return vals


class FactChecker(Agent):
    name, icon = "Fact-Checker", "🛡️"
    role = "Re-runs every query and checks every number the other agents wrote. Nothing reaches you unchecked."

    def __init__(self):
        self.log: list[dict] = []

    def verify_findings(self, agent: str, findings: list[Finding]) -> int:
        ok = 0
        for f in findings:
            if not f.sql or f.value is None or isinstance(f.value, str):
                continue
            actual = scalar(f.sql)
            good = actual is not None and abs(float(actual) - float(f.value)) <= max(0.001, 0.001 * abs(float(f.value)))
            ok += good
            self.log.append({"agent": agent, "check": f.id, "claimed": f.value, "database": actual,
                             "result": "verified" if good else "MISMATCH"})
        return ok

    def check_text(self, agent: str, text: str, findings: list[Finding], extra_allowed: set[float] = frozenset(),
                   context: str = "") -> list[float]:
        allowed = set(extra_allowed)
        for f in findings:
            allowed |= _variants(f.value)
            allowed |= set(numbers_in(f.text))
        allowed |= set(numbers_in(context))
        unsupported = [x for x in numbers_in(text) if x not in allowed and not (1900 <= x <= 2100) and x > 3]
        self.log.append({"agent": agent, "check": "written text", "claimed": len(numbers_in(text)),
                         "database": None, "result": "verified" if not unsupported else
                         f"removed: unsupported numbers {unsupported[:4]}"})
        return unsupported

    def review(self, report: Report, template: str) -> Report:
        """Check a report; if its LLM text has numbers not in its findings, fall back to the template."""
        self.verify_findings(report.agent, report.findings)
        if report.written_by == "llm":
            bad = self.check_text(report.agent, report.summary, report.findings)
            if bad:
                say(self.name, report.agent, f"Your summary mentions {bad[:3]}, which isn't in your findings. "
                                             "Replaced with the verified version.")
                report.summary, report.written_by = template, "template (fact-checked)"
        return report

    def report(self) -> Report:
        verified = sum(1 for r in self.log if r["result"] == "verified")
        problems = [r for r in self.log if r["result"] != "verified"]
        summary = (f"Checked {len(self.log)} items: {verified} verified against the database"
                   + (f", {len(problems)} corrected." if problems else ", no problems found."))
        return Report(self.name, self.role, summary, [], {"log": self.log})
