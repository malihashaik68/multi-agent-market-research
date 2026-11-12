"""Tests run without internet and without an LLM key: they use a tiny in-memory database and the published JSON."""
import json
import sqlite3
from pathlib import Path

import pandas as pd
import pytest

from market_research import tools
from market_research.agents.base import Finding, Report
from market_research.agents.factcheck import FactChecker, numbers_in
from market_research.agents.planner import WEIGHTS, PlannerAgent, score
from market_research.build import brand, segment

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "public" / "data"


@pytest.fixture()
def db(tmp_path, monkeypatch):
    path = tmp_path / "t.db"
    with sqlite3.connect(path) as con:
        pd.DataFrame({"camis": ["1", "2", "3", "4"], "segment": ["coffee", "coffee", "coffee", "bakery"],
                      "chain": [1, 0, 0, 0], "grade": ["A", "A", "B", None]}).to_sql("cafes", con, index=False)
    monkeypatch.setattr(tools, "DB", path)
    monkeypatch.setattr(tools.connect, "__defaults__", (path,))
    return path


# ------------------------------------------------------------ classification
@pytest.mark.parametrize("name,cuisine,expected", [
    ("STARBUCKS", "Coffee/Tea", "coffee"),
    ("DUNKIN'", "Donuts", "coffee"),
    ("KUNG FU TEA", "Coffee/Tea", "tea"),
    ("BLUE BOTTLE COFFEE", "American", "coffee"),
    ("MAMAJUANA CAFE", "Latin American", "other"),       # full restaurant with "cafe" in the name
    ("BANK OF NOVA SCOTIA CAFE", "American", "other"),   # office cafeteria
    ("FAY DA BAKERY", "Bakery Products/Desserts", "bakery"),
])
def test_segment(name, cuisine, expected):
    assert segment(cuisine, name) == expected


def test_brand_groups_chain_spellings():
    assert brand("DUNKIN'") == brand("DUNKIN DONUTS") == "DUNKIN"
    assert brand("BLANK STREET COFFEE") == brand("BLANK STREET")
    assert brand("NEW YORK BAGEL CAFE") != brand("NEW YORK COFFEE HOUSE")


# -------------------------------------------------------------------- tools
def test_sql_is_read_only(db):
    assert tools.scalar("SELECT COUNT(*) FROM cafes WHERE segment='coffee'") == 3
    for bad in ("DELETE FROM cafes", "DROP TABLE cafes", "INSERT INTO cafes(camis) VALUES ('9')"):
        with pytest.raises(Exception):
            tools.sql(bad)
    with pytest.raises(ValueError):
        tools.sql("SELECT 1; DROP TABLE cafes")
    assert tools.scalar("SELECT COUNT(*) FROM cafes") == 4


# ------------------------------------------------------------- fact-checker
def test_factchecker_verifies_and_catches_wrong_numbers(db):
    fc = FactChecker()
    good = Finding("n", "3 coffee shops", 3, "SELECT COUNT(*) FROM cafes WHERE segment='coffee'")
    bad = Finding("n2", "5 coffee shops", 5, "SELECT COUNT(*) FROM cafes WHERE segment='coffee'")
    assert fc.verify_findings("t", [good, bad]) == 1
    assert [r["result"] for r in fc.log] == ["verified", "MISMATCH"]


def test_factchecker_rejects_invented_numbers_in_llm_text(db):
    fc = FactChecker()
    findings = [Finding("share", "67% are independent", 0.6667, None), Finding("n", "3 coffee shops", 3, None)]
    assert fc.check_text("t", "There are 3 cafés and 67% are independent.", findings) == []
    assert fc.check_text("t", "There are 3 cafés and rent is $4,500 a month.", findings) == [4500.0]
    rep = Report("Agent", "", "Rent is $4,500.", findings, written_by="llm")
    out = fc.review(rep, "template text")
    assert out.summary == "template text" and out.written_by.startswith("template")


def test_numbers_in():
    assert numbers_in("$1,234 and 56% in 2026, 7.5 cups, 414k riders") == [1234.0, 56.0, 2026.0, 7.5, 414000.0]


def test_factchecker_allows_rounding_but_not_invention(db):
    fc = FactChecker()
    findings = [Finding("r", "111,454 riders", 111454, None)]
    assert fc.check_text("t", "About 111,000 riders (roughly 111k) pass by.", findings) == []
    assert fc.check_text("t", "About 150,000 riders pass by.", findings) == [150000.0]


# ------------------------------------------------------------ planner/score
def _hood(**kw):
    base = {f"score_{k}": 50.0 for k in WEIGHTS}
    base.update({"nta": "X", "median_income": 50000, "weekday_riders": 10000, "weekend_riders": 3000,
                 "area_type": "work", "coffee_shops": 10, "chain_coffee": 6, "bakeries_donuts_juice": 0,
                 "tea_shops": 0, "vacancy_rate": 0.05, "new_coffee_shops": 2})
    base.update(kw)
    return pd.Series(base)


def test_score_is_weighted_average():
    h = _hood(score_foot_traffic=100.0)
    assert score(h) == pytest.approx(50 + 50 * WEIGHTS["foot_traffic"] / sum(WEIGHTS.values()), abs=0.1)
    assert score(h, {"foot_traffic": 1}) == 100


def test_plan_follows_the_data():
    p = PlannerAgent().plan(_hood(), (30000, 60000))
    assert p["price_tier"] == "mid-range"
    assert any("closed" in h for h in p["hours"])          # weekends quiet in a work area (30% of weekday)
    assert any("chains" in s for s in p["stand_out"])      # 6 of 10 cafés are chains
    assert any("bakery" in s for s in p["stand_out"])      # no bakery nearby
    home = PlannerAgent().plan(_hood(area_type="home", median_income=80000), (30000, 60000))
    assert home["price_tier"] == "premium" and "6:30" in home["hours"][0]


# ------------------------------------------------- published results sanity
@pytest.mark.skipif(not (WEB / "analysis.json").exists(), reason="pipeline not run")
def test_published_results_are_consistent():
    a = json.loads((WEB / "analysis.json").read_text())
    hoods = json.loads((WEB / "neighbourhoods.json").read_text())
    picks = a["recommendation"]["data"]["picks"]
    assert len(picks) == 5 and [p["rank"] for p in picks] == [1, 2, 3, 4, 5]
    assert all(picks[i]["overall"] >= picks[i + 1]["overall"] for i in range(4))
    log = a["reports"]["checker"]["data"]["log"]
    assert log and all(r["result"] == "verified" or r["result"].startswith("removed") for r in log)
    by = {h["nta"]: h for h in hoods}
    for p in picks:  # the advisor's numbers match the published neighbourhood table
        assert f"{int(by[p['nta']]['coffee_shops'])} coffee shops" in " ".join(p["facts"])
    assert set(a["plans"]) == {h["nta"] for h in hoods if h["residential"]}


def test_pick_model_prefers_strong_chat_models():
    from market_research.llm import pick_model
    assert pick_model(["whisper-large-v3", "llama-3.1-8b-instant", "openai/gpt-oss-120b"]) == "openai/gpt-oss-120b"
    assert pick_model(["whisper-large-v3", "meta-llama/llama-guard-4-12b", "some-new-model"]) == "some-new-model"
    assert pick_model(["whisper-large-v3"]) is None
