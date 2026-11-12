"""Run the whole multi-agent study and publish the results for the website.

    python -m market_research.pipeline            # uses cached data; GROQ_API_KEY optional
    python -m market_research.pipeline --refresh  # re-download the data first
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pandas as pd

from market_research import build, fetch, llm
from market_research.agents.advisor import build_team
from market_research.agents.base import TRACE, say
from market_research.agents.planner import SCORE_LABELS, WEIGHTS, DesignerAgent, PlannerAgent
from market_research.tools import sql

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "public" / "data"
OUT = ROOT / "outputs"


def _json_default(o):
    if hasattr(o, "item"):
        return o.item()
    return str(o)


def run(refresh: bool = False) -> dict:
    t0 = time.time()
    if refresh:
        fetch.fetch_all()
    else:
        fetch.fetch_missing()
    meta = build.build()["meta"]
    TRACE.clear()
    team, checker, lead = build_team()
    say("Lead Advisor", "team", "New study: where should a first-time owner open a coffee shop in NYC? "
                                "Each of you, report on the whole city first.")

    reports = {}
    for key, agent in team.items():
        say("Lead Advisor", agent.name, "Citywide report, please.")
        rep = agent.citywide()
        reports[key] = checker.review(rep, agent.last_template)
        say(agent.name, "Lead Advisor", reports[key].summary)

    rec = lead.recommend(top_n=5)
    planner, designer = PlannerAgent(), DesignerAgent()
    hoods = sql("SELECT * FROM neighbourhoods WHERE residential=1")
    cut = tuple(hoods["median_income"].quantile([1 / 3, 2 / 3]))
    plans = {h["nta"]: planner.plan(h, cut) for _, h in hoods.iterrows()}
    say("Lead Advisor", planner.name, "Draft a plan for every neighbourhood: hours, prices, how to stand out, risks.")
    say(planner.name, "Lead Advisor", f"Done: {len(plans)} plans.")
    for p in rec.data["picks"]:
        facts = "\n".join(f"- {f}" for f in p["facts"]) + "\n" + "\n".join(
            f"- {x}" for x in plans[p["nta"]]["stand_out"])
        text, by = planner.write(facts, f"Suggest 3 creative, practical ideas for a new independent café in "
                                 f"{p['name']}, one sentence each, based only on these facts. Then suggest 3 short "
                                 "café names inspired by the neighbourhood. Format: Ideas: ... Names: ...",
                                 "", max_tokens=260)
        if by == "llm" and not checker.check_text(planner.name, text, [], context=facts):
            plans[p["nta"]]["ideas"] = text
    say("Lead Advisor", designer.name, "Prepare design concepts that match each area type.")
    design = designer.concept()
    reports["checker"] = checker.report()
    say(checker.name, "Lead Advisor", reports["checker"].summary)

    analysis = {
        "meta": {**meta, "generated": time.strftime("%Y-%m-%d"),
                 # only claim an LLM if it actually wrote something that passed the fact-checker
                 "llm": llm.MODEL if any(r.written_by == "llm" for r in reports.values()) or any(
                     p["written_by"] == "llm" for p in rec.data["picks"]) else None,
                 "runtime_seconds": round(time.time() - t0, 1)},
        "weights": WEIGHTS, "score_labels": SCORE_LABELS,
        "agents": [{"key": k, "name": a.name, "icon": a.icon, "role": a.role} for k, a in
                   [*team.items(), ("advisor", lead), ("planner", planner), ("designer", designer),
                    ("checker", checker)]],
        "reports": {k: r.to_dict() for k, r in reports.items()},
        "recommendation": rec.to_dict(), "plans": plans, "design": design, "trace": TRACE,
    }
    WEB.mkdir(parents=True, exist_ok=True)
    (WEB / "analysis.json").write_text(json.dumps(analysis, default=_json_default))
    write_reports(analysis)
    return analysis


def write_reports(a: dict) -> None:
    OUT.mkdir(exist_ok=True)
    picks = a["recommendation"]["data"]["picks"]
    lines = ["# Where to open a coffee shop in New York City", "",
             f"Data as of {a['meta']['as_of']}. {a['meta']['counts']['cafes']:,} coffee shops, "
             f"{a['meta']['counts']['neighbourhoods']} neighbourhoods, {a['meta']['counts']['stations']} subway stations.", "",
             "## Recommendation", ""]
    for p in picks:
        lines += [f"### {p['rank']}. {p['name']} ({p['borough']}): {p['overall']:.0f}/100", "", p["why"], ""]
    for k in ("competitor", "trend", "location", "operations"):
        r = a["reports"][k]
        lines += [f"## {r['agent']}", "", r["summary"], ""] + [f"- {f['text']}" for f in r["findings"]] + [""]
    lines += ["## Fact-check", "", a["reports"]["checker"]["summary"], ""]
    (OUT / "report.md").write_text("\n".join(lines))
    hoods = sql("SELECT * FROM neighbourhoods WHERE residential=1")
    with pd.ExcelWriter(OUT / "market_research.xlsx") as xl:  # ready for Power BI / Excel
        pd.DataFrame(picks).drop(columns=["scores", "facts"]).to_excel(xl, sheet_name="Recommendation", index=False)
        hoods.to_excel(xl, sheet_name="Neighbourhoods", index=False)
        sql("SELECT name, address, borough_name, segment, chain, grade, nta, opened_date FROM cafes "
            "LEFT JOIN (SELECT nta AS n2, borough AS borough_name FROM neighbourhoods) ON n2 = cafes.nta "
            "WHERE segment IN ('coffee','tea')").to_excel(xl, sheet_name="Coffee shops", index=False)
        pd.DataFrame(a["reports"]["checker"]["data"]["log"]).to_excel(xl, sheet_name="Fact-check log", index=False)


if __name__ == "__main__":
    out = run(refresh="--refresh" in sys.argv)
    print(json.dumps({"top": [p["name"] for p in out["recommendation"]["data"]["picks"]],
                      "checker": out["reports"]["checker"]["summary"], "llm": out["meta"]["llm"],
                      "seconds": out["meta"]["runtime_seconds"]}, indent=2))
