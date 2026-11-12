"""The specialist agents. Each one answers questions in its own area using SQL, and returns findings
with the query behind every number."""
from __future__ import annotations

import pandas as pd

from market_research.agents.base import Agent, Finding, Report, say
from market_research.tools import scalar, sql


def n(x) -> str:
    return f"{int(round(x)):,}"


def pct(x) -> str:
    return f"{100 * x:.0f}%"


def hood_sql(nta: str, expr: str) -> str:
    return f"SELECT {expr} FROM neighbourhoods WHERE nta = '{nta}'"


# ------------------------------------------------------------- competition
class CompetitorAgent(Agent):
    name, icon = "Competitor Analyst", "🔎"
    role = "Maps every coffee shop in NYC, separates chains from independents and finds under-served areas."

    def citywide(self) -> Report:
        total = scalar("SELECT COUNT(*) FROM cafes WHERE segment='coffee'")
        chains = scalar("SELECT COUNT(*) FROM cafes WHERE segment='coffee' AND chain=1")
        brands = sql("SELECT brand_name AS brand, COUNT(*) AS n FROM cafes WHERE segment='coffee' AND chain=1 "
                     "GROUP BY brand_name ORDER BY n DESC LIMIT 8")
        crowded = sql("SELECT nta, name, borough, coffee_shops, riders_per_cafe FROM neighbourhoods "
                      "WHERE residential=1 AND coffee_shops>=10 AND weekday_riders>=15000 ORDER BY riders_per_cafe ASC LIMIT 5")
        underserved = sql("SELECT nta, name, borough, coffee_shops, weekday_riders, riders_per_cafe FROM neighbourhoods "
                          "WHERE residential=1 AND weekday_riders>=15000 ORDER BY riders_per_cafe DESC LIMIT 5")
        f = [
            Finding("coffee_total", f"NYC has {n(total)} coffee shops with a current health permit.", total,
                    "SELECT COUNT(*) FROM cafes WHERE segment='coffee'"),
            Finding("chain_share", f"{pct(chains / total)} of them are chain branches ({n(chains)} shops).",
                    round(chains / total, 4),
                    "SELECT 1.0*SUM(chain)/COUNT(*) FROM cafes WHERE segment='coffee'", "share"),
            Finding("top_brands", "Biggest chains: " + ", ".join(f"{b} ({k})" for b, k in
                    zip(brands["brand"], brands["n"]) if k) + ".", ", ".join(brands["brand"].head(3))),
        ]
        r = underserved.iloc[0]
        f.append(Finding("most_underserved", f"Most under-served busy area: {r['name']} ({r['borough']}), with "
                         f"{n(r['riders_per_cafe'])} weekday subway riders for every coffee shop.", r["riders_per_cafe"],
                         hood_sql(r["nta"], "riders_per_cafe")))
        c = crowded.iloc[0]
        f.append(Finding("most_crowded", f"Most crowded: {c['name']} ({c['borough']}), only {n(c['riders_per_cafe'])} "
                         f"weekday riders per coffee shop.", c["riders_per_cafe"], hood_sql(c["nta"], "riders_per_cafe")))
        summary = (f"There are {n(total)} coffee shops in NYC and {pct(chains / total)} are chains, led by "
                   f"{brands['brand'].iloc[0].title()} and {brands['brand'].iloc[1].title()}. Busy areas with few "
                   f"cafés, like {r['name']}, are the openings to look for; areas like {c['name']} are crowded.")
        text, by = self.write("\n".join(x.text for x in f), "Summarise the competition in 3 sentences.", summary)
        return Report(self.name, self.role, text, f, {"brands": brands.to_dict("records"),
                      "crowded": crowded.to_dict("records"), "underserved": underserved.to_dict("records")}, by)

    def brief(self, nta: str) -> list[Finding]:
        h = sql(f"SELECT * FROM neighbourhoods WHERE nta='{nta}'").iloc[0]
        near = sql(f"SELECT brand_name, chain FROM cafes WHERE nta='{nta}' AND segment='coffee'")
        top_chains = near[near["chain"] == 1]["brand_name"].value_counts().head(3)
        out = [Finding(f"{nta}.coffee_shops", f"{n(h['coffee_shops'])} coffee shops "
                       f"({n(h['chain_coffee'])} chain, {n(h['independent_coffee'])} independent)",
                       h["coffee_shops"], hood_sql(nta, "coffee_shops")),
               Finding(f"{nta}.riders_per_cafe", f"{n(h['riders_per_cafe'])} weekday subway riders per coffee shop",
                       h["riders_per_cafe"], hood_sql(nta, "riders_per_cafe"))]
        if len(top_chains):
            out.append(Finding(f"{nta}.chains", "Chains here: " + ", ".join(top_chains.index[:3]), None))
        if h["bakeries_donuts_juice"] == 0:
            out.append(Finding(f"{nta}.no_bakery", "No bakery, donut or juice shop: room for pastries and fresh juice",
                               0, hood_sql(nta, "bakeries_donuts_juice")))
        return out


# ------------------------------------------------------------------ trends
class TrendAgent(Agent):
    name, icon = "Trend Analyst", "📈"
    role = "Tracks where new coffee shops opened in the last two years and who is opening them."

    def citywide(self) -> Report:
        months = scalar("SELECT 24")
        new = scalar("SELECT COUNT(*) FROM cafes WHERE segment='coffee' AND opened_recently=1")
        new_chain = scalar("SELECT COUNT(*) FROM cafes WHERE segment='coffee' AND opened_recently=1 AND chain=1")
        by_q = sql("SELECT substr(opened_date,1,4) || '-Q' || ((CAST(substr(opened_date,6,2) AS INT)+2)/3) AS quarter, "
                   "SUM(chain=0) AS independent, SUM(chain=1) AS chain FROM cafes WHERE segment='coffee' "
                   "AND opened_recently=1 GROUP BY quarter ORDER BY quarter")
        hot = sql("SELECT nta, name, borough, new_coffee_shops, coffee_shops FROM neighbourhoods WHERE residential=1 "
                  "ORDER BY new_coffee_shops DESC LIMIT 6")
        brands = sql("SELECT brand_name AS brand, COUNT(*) AS n FROM cafes WHERE segment='coffee' AND opened_recently=1 "
                     "AND chain=1 GROUP BY brand_name ORDER BY n DESC LIMIT 5")
        h = hot.iloc[0]
        f = [Finding("new_total", f"{n(new)} new coffee shops opened in the last {months} months.", new,
                     "SELECT COUNT(*) FROM cafes WHERE segment='coffee' AND opened_recently=1"),
             Finding("new_independent_share", f"{pct(1 - new_chain / new)} of new openings are independent cafés.",
                     round(1 - new_chain / new, 4),
                     "SELECT 1.0*SUM(chain=0)/COUNT(*) FROM cafes WHERE segment='coffee' AND opened_recently=1", "share"),
             Finding("hottest", f"Most openings: {h['name']} ({h['borough']}) with {n(h['new_coffee_shops'])} new "
                     f"coffee shops.", h["new_coffee_shops"], hood_sql(h["nta"], "new_coffee_shops"))]
        if len(brands):
            f.append(Finding("expanding_chains", "Chains opening the most: " + ", ".join(
                f"{b} ({k})" for b, k in zip(brands["brand"], brands["n"])) + ".", None))
        summary = (f"{n(new)} coffee shops opened in the last {months} months and {pct(1 - new_chain / new)} of them "
                   f"are independent, so there is still room for small owners. The busiest new-café scene is "
                   f"{h['name']}.")
        text, by = self.write("\n".join(x.text for x in f), "Summarise the trends in 3 sentences.", summary)
        return Report(self.name, self.role, text, f, {"by_quarter": by_q.to_dict("records"),
                      "hottest": hot.to_dict("records"), "expanding_chains": brands.to_dict("records")}, by)

    def brief(self, nta: str) -> list[Finding]:
        h = sql(f"SELECT new_coffee_shops, coffee_shops FROM neighbourhoods WHERE nta='{nta}'").iloc[0]
        return [Finding(f"{nta}.new", f"{n(h['new_coffee_shops'])} new coffee shops in the last 24 months",
                        h["new_coffee_shops"], hood_sql(nta, "new_coffee_shops"))]


# ---------------------------------------------------------------- location
class LocationAgent(Agent):
    name, icon = "Location Scout", "📍"
    role = "Measures foot traffic, commuter patterns, storefront space and local spending power."

    def citywide(self) -> Report:
        top = sql("SELECT nta, name, borough, weekday_riders FROM neighbourhoods WHERE residential=1 "
                  "ORDER BY weekday_riders DESC LIMIT 5")
        vac = sql("SELECT nta, name, borough, vacant, storefronts FROM neighbourhoods WHERE residential=1 "
                  "ORDER BY vacant DESC LIMIT 5")
        types = sql("SELECT area_type, COUNT(*) AS n FROM neighbourhoods WHERE residential=1 AND area_type IS NOT NULL "
                    "GROUP BY area_type")
        t, v = top.iloc[0], vac.iloc[0]
        f = [Finding("busiest", f"Busiest area: {t['name']} with {n(t['weekday_riders'])} subway entries on a "
                     f"typical weekday.", t["weekday_riders"], hood_sql(t["nta"], "weekday_riders")),
             Finding("most_vacant", f"Most empty storefronts: {v['name']} ({n(v['vacant'])} vacant of "
                     f"{n(v['storefronts'])}).", v["vacant"], hood_sql(v["nta"], "vacant"))]
        summary = (f"Foot traffic is highest around {t['name']}. Empty storefronts, where a new café could move in, "
                   f"are most common in {v['name']}. Home areas have a morning rush; work areas are busy all day on "
                   f"weekdays but quieter at weekends.")
        text, by = self.write("\n".join(x.text for x in f), "Summarise location insights in 3 sentences.", summary)
        return Report(self.name, self.role, text, f, {"busiest": top.to_dict("records"), "vacant": vac.to_dict("records"),
                      "area_types": types.to_dict("records")}, by)

    def brief(self, nta: str) -> list[Finding]:
        h = sql(f"SELECT * FROM neighbourhoods WHERE nta='{nta}'").iloc[0]
        kind = {"home": "a home area (people leave for work in the morning: a morning coffee crowd)",
                "work": "a work area (workers arrive in the morning and leave 4-8 pm: busy weekdays, quieter weekends)",
                "mixed": "a mixed home-and-work area (steady traffic through the day)"}.get(h["area_type"],
                "an area without a subway station (local, neighbourhood customers)")
        out = [Finding(f"{nta}.riders", f"{n(h['weekday_riders'])} subway entries on a typical weekday "
                       f"({n(h['stations'])} stations)", h["weekday_riders"], hood_sql(nta, "weekday_riders")),
               Finding(f"{nta}.area_type", f"It is {kind}", h["area_type"]),
               Finding(f"{nta}.storefronts", f"{n(h['storefronts'])} storefronts, {n(h['vacant'])} of them vacant",
                       h["vacant"], hood_sql(nta, "vacant"))]
        if pd.notna(h["median_income"]):
            out.append(Finding(f"{nta}.income", f"Median resident income about ${n(h['median_income'])} "
                               "(NYC Neighborhood Financial Health, 2020)", h["median_income"],
                               hood_sql(nta, "median_income")))
        return out


# ----------------------------------------------------- what works / fails
VIOLATION_TIPS = {
    "04L": "Mice: seal gaps, store food off the floor, use a licensed pest-control service.",
    "04M": "Roaches: weekly pest control and no standing water or food crumbs overnight.",
    "04N": "Flies: screens, closed bins, clean drains.",
    "06C": "Food not protected: cover food, use sneeze guards, label containers.",
    "02G": "Cold food too warm: keep milk and cold items at 41°F or below; check fridges daily.",
    "02B": "Hot food not hot enough: hold hot food at 140°F or above.",
    "10F": "Surfaces not smooth/easy to clean: choose easy-clean counters and repair damaged surfaces.",
    "08A": "Not pest-proof: seal holes and gaps around pipes and doors.",
    "06D": "Surfaces not cleaned and sanitised properly: sanitise after every use.",
    "10B": "Plumbing or drainage problems: fix leaks, keep proper drains.",
    "04H": "Food contact with contaminants: separate raw and ready-to-eat items.",
    "06E": "Sanitised equipment contaminated: store clean utensils properly.",
    "09C": "Food contact surfaces not well maintained: replace worn equipment.",
    "02H": "Food not cooled properly: cool quickly in shallow containers.",
    "10H": "Dishwashing problems: check the sanitising temperature or chemical level.",
    "04A": "No Food Protection Certificate holder on duty: make sure a certified manager is always on shift.",
    "06F": "Wiping cloths left out: keep them in sanitising solution between uses.",
}
PEST_CODES = "('04K','04L','04M','04N','08A')"


class OperationsAgent(Agent):
    name, icon = "Operations Analyst", "✅"
    role = "Studies what successful cafés do right and what gets cafés in trouble (health grades, closures)."

    def citywide(self) -> Report:
        a_share = scalar("SELECT AVG(grade='A') FROM cafes WHERE segment='coffee' AND grade IS NOT NULL")
        a_chain = scalar("SELECT AVG(grade='A') FROM cafes WHERE segment='coffee' AND grade IS NOT NULL AND chain=1")
        a_ind = scalar("SELECT AVG(grade='A') FROM cafes WHERE segment='coffee' AND grade IS NOT NULL AND chain=0")
        closed = scalar("SELECT AVG(dohmh_closures>0) FROM cafes WHERE segment='coffee'")
        top_v = sql("SELECT v.violation_code AS code, MIN(v.violation_description) AS description, "
                    "COUNT(DISTINCT v.camis) AS cafes FROM violations v JOIN cafes c USING(camis) "
                    "WHERE c.segment='coffee' AND v.critical_flag='Critical' GROUP BY code ORDER BY cafes DESC LIMIT 8")
        pest_sql = ("SELECT 1.0*COUNT(DISTINCT CASE WHEN v.violation_code IN " + PEST_CODES + " THEN v.camis END)"
                    "/COUNT(DISTINCT v.camis) FROM violations v JOIN cafes c USING(camis) "
                    "WHERE c.segment='coffee' AND v.closure=1")
        pest_share = scalar(pest_sql)
        closed_n = scalar("SELECT COUNT(DISTINCT v.camis) FROM violations v JOIN cafes c USING(camis) "
                          "WHERE c.segment='coffee' AND v.closure=1")
        top_v["tip"] = top_v["code"].map(VIOLATION_TIPS).fillna("")
        f = [Finding("grade_a_share", f"{pct(a_share)} of NYC coffee shops hold an A health grade.", a_share,
                     "SELECT AVG(grade='A') FROM cafes WHERE segment='coffee' AND grade IS NOT NULL", "share"),
             Finding("grade_a_chain_vs_ind", f"Chains: {pct(a_chain)} A grades; independents: {pct(a_ind)}.", a_ind,
                     "SELECT AVG(grade='A') FROM cafes WHERE segment='coffee' AND grade IS NOT NULL AND chain=0", "share"),
             Finding("closure_share", f"{pct(closed)} of coffee shops were temporarily closed by the Health Department "
                     "at least once in the last few years.", closed,
                     "SELECT AVG(dohmh_closures>0) FROM cafes WHERE segment='coffee'", "share"),
             Finding("pest_share_closed", f"{pct(pest_share)} of the {n(closed_n)} coffee shops closed by inspectors "
                     "had a pest problem (mice, roaches, flies or gaps that let pests in) at that inspection.",
                     pest_share, pest_sql, "share"),
             Finding("top_violation", "Most common serious problem: " + (VIOLATION_TIPS.get(top_v.iloc[0]["code"]) or
                     top_v.iloc[0]["description"]).split(":")[0].lower() + f" (found at {n(top_v.iloc[0]['cafes'])} "
                     "coffee shops).", int(top_v.iloc[0]["cafes"]),
                     "SELECT COUNT(DISTINCT v.camis) FROM violations v JOIN cafes c USING(camis) WHERE c.segment='coffee' "
                     f"AND v.critical_flag='Critical' AND v.violation_code='{top_v.iloc[0]['code']}'")]
        lessons = [
            {"title": "Keep an A grade from day one",
             "text": f"{pct(a_share)} of coffee shops have an A. Customers see the grade in the window, so a B or C "
                     "puts you behind most competitors.", "source": "NYC DOHMH inspections"},
            {"title": "Pests are the top reason cafés get shut",
             "text": f"{pct(pest_share)} of the coffee shops the Health Department closed had a pest problem at that "
                     "inspection. A pest-control contract and sealing gaps around pipes and doors are must-haves.",
             "source": "NYC DOHMH inspections"},
            {"title": "Chains run tight processes; independents can too",
             "text": f"Chains hold A grades {pct(a_chain)} of the time vs {pct(a_ind)} for independents. Daily "
                     "checklists (fridge temperatures, cleaning, pest checks) close that gap.",
             "source": "NYC DOHMH inspections"},
            {"title": "Don't open where it's already crowded",
             "text": "Areas with few riders per café split the same customers many ways. Look for busy streets "
                     "that have few cafés (see the map).", "source": "MTA ridership + DOHMH data"},
        ]
        summary = (f"Successful cafés keep their A grade ({pct(a_share)} do), control pests and check fridge "
                   f"temperatures daily. {pct(closed)} of coffee shops were closed by the Health Department at least "
                   f"once, and {pct(pest_share)} of those had pest problems: the easiest failure to avoid.")
        text, by = self.write("\n".join(x.text for x in f), "Summarise what separates well-run cafés from those in "
                              "trouble, in 3 sentences.", summary)
        return Report(self.name, self.role, text, f, {"top_violations": top_v.to_dict("records"), "lessons": lessons}, by)

    def brief(self, nta: str) -> list[Finding]:
        h = sql(f"SELECT grade_a_share, closures_per_cafe FROM neighbourhoods WHERE nta='{nta}'").iloc[0]
        out = []
        if pd.notna(h["grade_a_share"]):
            out.append(Finding(f"{nta}.grade_a", f"{pct(h['grade_a_share'])} of local coffee shops have an A grade",
                               h["grade_a_share"], hood_sql(nta, "grade_a_share"), "share"))
        return out
