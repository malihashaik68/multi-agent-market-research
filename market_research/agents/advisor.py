"""Lead Advisor: coordinates the team and makes the final recommendation.

It ranks every neighbourhood, then asks each specialist for a brief on the top candidates, writes the
recommendation, and sends everything to the fact-checker before it is published.
"""
from __future__ import annotations

import pandas as pd

from market_research.agents.base import Agent, Finding, Report, say
from market_research.agents.factcheck import FactChecker
from market_research.agents.planner import SCORE_LABELS, WEIGHTS, score

WATCH_OUT = {"foot_traffic": "fewer people passing by", "low_competition": "lots of competition",
             "available_space": "few empty storefronts to choose from", "spending_power": "lower local incomes",
             "growing_scene": "few new cafés opening (less proven demand)",
             "independent_friendly": "chains dominate"}
RENT_NOTE = ("Rent is not in public data: central Manhattan rents are among the highest in the country, so check "
             "listings before deciding.")
from market_research.agents.specialists import (CompetitorAgent, LocationAgent, OperationsAgent, TrendAgent)
from market_research.tools import sql


class LeadAdvisor(Agent):
    name, icon = "Lead Advisor", "🧑‍💼"
    role = "Coordinates the team, weighs everything and recommends where to open, and why."

    def __init__(self, team: dict, checker: FactChecker):
        self.team, self.checker = team, checker

    def rank(self, weights: dict = WEIGHTS) -> pd.DataFrame:
        h = sql("SELECT * FROM neighbourhoods WHERE residential=1")
        h["overall"] = h.apply(score, axis=1, weights=weights)
        return h.sort_values("overall", ascending=False).reset_index(drop=True)

    def recommend(self, top_n: int = 5, weights: dict = WEIGHTS) -> Report:
        ranked = self.rank(weights)
        say(self.name, "team", f"Ranked {len(ranked)} neighbourhoods on: " + ", ".join(
            f"{SCORE_LABELS[k]} {int(w * 100)}%" for k, w in weights.items()) + f". Briefing on the top {top_n}.")
        picks = []
        for i, h in ranked.head(top_n).iterrows():
            findings = []
            for key in ("competitor", "location", "trend", "operations"):
                agent = self.team[key]
                say(self.name, agent.name, f"Brief me on {h['name']}.")
                got = agent.brief(h["nta"])
                say(agent.name, self.name, "; ".join(f.text for f in got) or "Nothing notable.")
                findings += got
            self.checker.verify_findings(f"Brief: {h['name']}", findings)
            strengths = [SCORE_LABELS[k] for k in WEIGHTS if h[f"score_{k}"] >= 70]
            weak = [WATCH_OUT[k] for k in WEIGHTS if h[f"score_{k}"] < 30]
            if h["borough"] == "Manhattan" and h["nta"][:4] in {"MN01", "MN02", "MN03", "MN04", "MN05", "MN06"}:
                weak.append("very high rents likely")
            template = (f"{h['name']} scores {h['overall']:.0f}/100. "
                        + (f"Strong on {', '.join(strengths).lower()}. " if strengths else "")
                        + " ".join(f.text + "." for f in findings[:3])
                        + (f" Watch out: {', '.join(weak)}." if weak else ""))
            facts = "\n".join(f"- {f.text}" for f in findings) + \
                    f"\n- Overall score {h['overall']:.0f}/100; strengths: {', '.join(strengths) or 'none'}; " \
                    f"weaker: {', '.join(weak) or 'none'}"
            text, by = self.write(facts, f"In 3-4 sentences, explain to a first-time café owner why {h['name']} "
                                  "is a good place to open, and one thing to watch out for.", template)
            if by == "llm":
                bad = self.checker.check_text(self.name, text, findings, {round(h["overall"]), 100.0}, context=facts)
                if bad:
                    say(self.checker.name, self.name, f"Your text about {h['name']} mentions {bad[:3]}, not in the "
                                                     "briefs. Replaced with the verified version.")
                    text, by = template, "template (fact-checked)"
            picks.append({"rank": i + 1, "nta": h["nta"], "name": h["name"], "borough": h["borough"],
                          "overall": h["overall"], "why": text, "written_by": by, "strengths": strengths,
                          "watch_out": weak, "facts": [f.text for f in findings],
                          "scores": {k: h[f"score_{k}"] for k in WEIGHTS}})
        by_borough = []
        for boro, g in ranked.groupby("borough", sort=False):
            h = g.iloc[0]
            by_borough.append({"borough": boro, "nta": h["nta"], "name": h["name"], "overall": h["overall"],
                               "rank": int(g.index[0]) + 1})
        say(self.name, "team", "Also noting the best option in each borough: " + "; ".join(
            f"{b['borough']}: {b['name']}" for b in by_borough) + ". " + RENT_NOTE)
        best = picks[0]
        summary = (f"Top pick: {best['name']} ({best['borough']}), followed by "
                   + ", ".join(p["name"] for p in picks[1:]) + ".")
        return Report(self.name, self.role, summary,
                      [Finding("top_pick", summary, best["overall"])],
                      {"picks": picks, "by_borough": by_borough, "weights": weights, "rent_note": RENT_NOTE})


def build_team() -> tuple[dict, FactChecker, LeadAdvisor]:
    team = {"competitor": CompetitorAgent(), "trend": TrendAgent(), "location": LocationAgent(),
            "operations": OperationsAgent()}
    checker = FactChecker()
    return team, checker, LeadAdvisor(team, checker)
