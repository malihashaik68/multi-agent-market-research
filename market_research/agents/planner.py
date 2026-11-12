"""Business Planner and Café Designer agents: turn a neighbourhood's numbers into a plan and a look."""
from __future__ import annotations

import pandas as pd

from market_research.agents.base import Agent

WEIGHTS = {  # default "balanced" priorities; the website lets the user change these
    "foot_traffic": 0.30, "low_competition": 0.25, "available_space": 0.15,
    "spending_power": 0.10, "growing_scene": 0.10, "independent_friendly": 0.10,
}
SCORE_LABELS = {
    "foot_traffic": "Foot traffic", "low_competition": "Low competition", "available_space": "Available storefronts",
    "spending_power": "Spending power", "growing_scene": "Growing café scene", "independent_friendly": "Independent-friendly",
}


def score(row: pd.Series, weights: dict = WEIGHTS) -> float:
    total = sum(weights.values()) or 1
    return round(sum(row[f"score_{k}"] * w for k, w in weights.items()) / total, 1)


class PlannerAgent(Agent):
    name, icon = "Business Planner", "🧾"
    role = "Turns the research into a plan for your café: hours, prices, what to sell, how to stand out, risks."

    def plan(self, h: pd.Series, income_cut: tuple[float, float]) -> dict:
        lo, hi = income_cut
        inc = h["median_income"]
        tier = "premium" if inc >= hi else "value" if inc <= lo else "mid-range"
        prices = {"value": "Keep it affordable: a simple menu with good drip coffee and fair-priced lattes; deals for regulars.",
                  "mid-range": "Mid-range prices: quality espresso drinks at fair prices, with a few premium specials.",
                  "premium": "Premium is welcome here: specialty beans, pour-overs and seasonal signature drinks."}[tier]
        weekend_ratio = h["weekend_riders"] / h["weekday_riders"] if h["weekday_riders"] else 1
        area = h["area_type"] if isinstance(h["area_type"], str) else "local"
        hours = {
            "home": ["Mon-Fri 6:30 am - 3 pm (catch commuters from 7 to 9 am)", "Sat-Sun 8 am - 4 pm (relaxed brunch crowd)"],
            "work": ["Mon-Fri 7 am - 6 pm (morning rush, lunch, afternoon pick-me-up)",
                     "Weekends: short hours or closed" if weekend_ratio < 0.45 else "Weekends 9 am - 4 pm"],
            "mixed": ["Every day 7 am - 7 pm (steady traffic all day)"],
            "local": ["Mon-Fri 7 am - 4 pm", "Sat-Sun 8 am - 5 pm (neighbourhood regulars)"],
        }[area]
        stand_out = []
        if h["coffee_shops"] and h["chain_coffee"] / max(h["coffee_shops"], 1) >= 0.5:
            stand_out.append("Most cafés here are chains: be the warm, local alternative where staff know regulars by name.")
        elif h["coffee_shops"] >= 5:
            stand_out.append("Many independent cafés already: stand out with one signature thing (a house roast, "
                             "a pastry, a cosy space).")
        else:
            stand_out.append("Few cafés here: you can be THE neighbourhood café. Focus on consistency and friendliness.")
        if h["bakeries_donuts_juice"] == 0:
            stand_out.append("No bakery or juice bar nearby: fresh pastries or smoothies fill a real gap.")
        if h["tea_shops"] >= 2:
            stand_out.append("Bubble-tea shops are popular here: add matcha and iced tea drinks.")
        if area == "work":
            stand_out.append("Office crowd: fast service, mobile ordering and a breakfast-to-go menu.")
        elif area == "home":
            stand_out.append("Residents: comfy seating, laptop-friendly tables and a loyalty card.")
        risks = []
        if h["score_low_competition"] < 35:
            risks.append("Crowded market: many cafés share the same customers.")
        if h["score_foot_traffic"] < 35:
            risks.append("Lower foot traffic: you'll rely on regulars, so marketing and loyalty matter.")
        if area == "work" and weekend_ratio < 0.45:
            risks.append("Weekends are quiet in work areas: plan for 5 strong days, not 7.")
        if isinstance(h["vacancy_rate"], float) and h["vacancy_rate"] > 0.08:
            risks.append("Many empty storefronts: rent may be negotiable, but check why the street is struggling.")
        if h["new_coffee_shops"] >= 10:
            risks.append("Lots of new cafés opening: competition is rising fast.")
        risks.append("Keep an A health grade: pest control and daily fridge checks from day one.")
        return {"nta": h["nta"], "price_tier": tier, "prices": prices, "hours": hours, "stand_out": stand_out,
                "risks": risks, "area_type": area}


DESIGN_STYLES = {
    "cozy": {
        "label": "Cozy & warm",
        "palette": [["Espresso", "#3B2A20"], ["Caramel", "#C68B59"], ["Cream", "#F5EBDD"], ["Sage", "#8A9A7B"],
                    ["Terracotta", "#B5654A"]],
        "materials": ["Warm oak tables", "Soft fabric armchairs", "Woven rugs", "Lots of plants", "Linen curtains"],
        "lighting": "Warm 2700K pendant lamps and table lamps; no harsh white light.",
        "music": "Soft acoustic, jazz and lo-fi at low volume.",
        "details": ["A bookshelf corner", "Hand-written chalkboard specials", "Mismatched mugs", "Window seats"],
    },
    "vintage": {
        "label": "Vintage & classic",
        "palette": [["Forest green", "#2F4A3A"], ["Brass", "#B08D57"], ["Ivory", "#F3EAD7"], ["Burgundy", "#6E2C2C"],
                    ["Walnut", "#5A3E2B"]],
        "materials": ["Green subway tiles", "Brass fixtures", "Dark walnut counter", "Bentwood chairs",
                      "Marble-top tables"],
        "lighting": "Edison bulbs and brass wall sconces for a golden glow.",
        "music": "Old jazz, soul and vinyl records.",
        "details": ["A vintage espresso machine on show", "Framed old New York photos", "Letter-board menu",
                    "A record player corner"],
    },
}
LAYOUTS = {
    "work": {"label": "Grab-and-go", "seats": 14, "notes": ["Long counter with two ordering points",
             "Mobile-order pick-up shelf by the door", "Standing bar along the window", "A few two-person tables"]},
    "home": {"label": "Stay-and-relax", "seats": 28, "notes": ["Comfy lounge corner with armchairs",
             "Communal table with outlets for laptops", "Window bench seating", "Small kids-friendly corner"]},
    "mixed": {"label": "All-day café", "seats": 22, "notes": ["Fast counter for the morning rush",
              "Mix of small tables and a communal table", "Window bar", "Cosy corner for afternoon visitors"]},
    "local": {"label": "Neighbourhood café", "seats": 20, "notes": ["Friendly counter where you chat with regulars",
              "Small tables and one big table", "Pastry display at the front", "Community notice board"]},
}


class DesignerAgent(Agent):
    name, icon = "Café Designer", "🎨"
    role = "Suggests the look and layout of your café: style, colours, materials, seating plan."

    def concept(self) -> dict:
        return {"styles": DESIGN_STYLES, "layouts": LAYOUTS}
