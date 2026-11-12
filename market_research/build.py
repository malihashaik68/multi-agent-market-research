"""Turn the raw downloads into clean tables: one row per café, one row per neighbourhood.

Output:
  data/nyc_cafes.db              SQLite (cafes, neighbourhoods, stations, violations) for the agents' SQL tools
  web/public/data/*.json         compact files for the website
"""
from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
DB = ROOT / "data" / "nyc_cafes.db"
WEB = ROOT / "web" / "public" / "data"

AS_OF = None  # set from the data (latest inspection date)
RECENT_MONTHS = 24
BORO_CODE = {"MN": "Manhattan", "BK": "Brooklyn", "QN": "Queens", "BX": "Bronx", "SI": "Staten Island"}

# ---------------------------------------------------------------- cafés
STRONG_COFFEE = re.compile(r"\b(COFFEE|ESPRESSO|ROASTER[S]?|ROASTERY|CAFFE)\b")
CAFE_NAME = re.compile(r"\b(CAFE|CAFÉ)\b")
# "Cafe" in the name only counts for café-like categories (not full-service restaurants like "Mamajuana Cafe")
CAFE_LIKE = {"Coffee/Tea", "American", "Bakery Products/Desserts", "Sandwiches", "Juice, Smoothies, Fruit Salads",
             "Other", "Donuts", "Salads", "Soups/Salads/Sandwiches"}
TEA_NAME = re.compile(r"\b(BUBBLE|BOBA|GONG CHA|KUNG FU TEA|TEA HOUSE|TEAHOUSE|MILK TEA|CHATIME|TIGER SUGAR|COCO|"
                      r"VIVI|YI FANG|MOGE TEE|XING FU TANG|BOBA GUYS|TEAZZI|PRESOTEA|HEYTEA|MOLLY TEA|CHAGEE|SHARETEA)\b")
OFFICE_CAFETERIA = re.compile(r"\b(BANK|TRUST|CAPITAL|CARRIER|ANNEX|HOSPITAL|SCHOOL|UNIVERSITY|EMPLOYEE|CAFETERIA)\b")


def brand(name: str) -> str:
    """Normalise a business name so branches of a chain share one brand key."""
    n = re.sub(r"[^A-Z0-9 ]", " ", (name or "").upper().replace("'", ""))
    n = re.sub(r"\s+", " ", n).strip()
    if n.startswith("DUNKIN"):
        return "DUNKIN"
    if n.startswith("STARBUCKS"):
        return "STARBUCKS"
    n = re.sub(r"\b(COFFEE|CAFE|CAFFE|ESPRESSO|BAR|SHOP|CO|INC|LLC|NYC|THE)\b", "", n)
    return " ".join(n.split()) or (name or "").upper()


def segment(cuisine: str, name: str) -> str:
    up = (name or "").upper()
    if OFFICE_CAFETERIA.search(up):
        return "other"
    if cuisine == "Coffee/Tea":
        return "tea" if TEA_NAME.search(up) and not STRONG_COFFEE.search(up) else "coffee"
    if up.startswith("DUNKIN") or STRONG_COFFEE.search(up) or (CAFE_NAME.search(up) and cuisine in CAFE_LIKE):
        return "coffee"
    return {"Bakery Products/Desserts": "bakery", "Donuts": "donuts",
            "Juice, Smoothies, Fruit Salads": "juice"}.get(cuisine, "other")


def load_cafes() -> tuple[pd.DataFrame, pd.DataFrame]:
    global AS_OF
    raw = pd.DataFrame(json.loads((RAW / "inspections.json").read_text()))
    raw["inspection_date"] = pd.to_datetime(raw["inspection_date"], errors="coerce")
    raw = raw[raw["inspection_date"] > "1950-01-01"]
    AS_OF = raw["inspection_date"].max()
    raw["score"] = pd.to_numeric(raw["score"], errors="coerce")
    for c in ("latitude", "longitude"):
        raw[c] = pd.to_numeric(raw[c], errors="coerce")

    recent_cut = AS_OF - pd.DateOffset(months=RECENT_MONTHS)
    rows = []
    for camis, g in raw.sort_values("inspection_date").groupby("camis"):
        last = g.iloc[-1]
        visits = g.drop_duplicates(["inspection_date", "inspection_type"])
        graded = g.dropna(subset=["grade"])
        graded = graded[graded["grade"].isin(["A", "B", "C"])]
        preperm = g[g["inspection_type"].str.startswith("Pre-permit", na=False)]
        rows.append({
            "camis": camis, "name": str(last["dba"]).title(), "brand": brand(last["dba"]),
            "cuisine": last["cuisine_description"], "segment": segment(last["cuisine_description"], last["dba"]),
            "address": f"{last['building'] or ''} {str(last['street'] or '').title()}".strip(),
            "zipcode": last["zipcode"], "lat": g["latitude"].dropna().iloc[-1] if g["latitude"].notna().any() else np.nan,
            "lon": g["longitude"].dropna().iloc[-1] if g["longitude"].notna().any() else np.nan,
            "first_seen": g["inspection_date"].min(), "last_inspection": last["inspection_date"],
            "opened_recently": bool(len(preperm) and preperm["inspection_date"].min() >= recent_cut),
            "opened_date": preperm["inspection_date"].min() if len(preperm) else pd.NaT,
            "grade": graded.iloc[-1]["grade"] if len(graded) else None,
            "inspections": len(visits),
            "avg_score": round(float(visits["score"].mean()), 1) if visits["score"].notna().any() else None,
            "critical_violations": int((g["critical_flag"] == "Critical").sum()),
            "dohmh_closures": int(visits["action"].str.contains("Closed by DOHMH|re-closed", case=False, na=False).sum()),
        })
    cafes = pd.DataFrame(rows)
    cafes = cafes[cafes["lat"].between(40.4, 41.0) & cafes["lon"].between(-74.3, -73.6)].copy()
    sizes = cafes.groupby("brand")["camis"].transform("count")
    cafes["chain"] = sizes >= 5
    # display name of a chain = its most common spelling ("Dunkin'" and "Dunkin" -> one name)
    display = cafes.groupby("brand")["name"].agg(lambda x: x.str.replace("'S", "'s").value_counts().index[0])
    cafes["brand_name"] = cafes["brand"].map(display)
    violations = raw[raw["violation_code"].notna() & raw["camis"].isin(cafes["camis"])][
        ["camis", "inspection_date", "violation_code", "violation_description", "critical_flag", "action"]].copy()
    violations["closure"] = violations["action"].str.contains("Closed by DOHMH|re-closed", case=False, na=False).astype(int)
    violations = violations.drop(columns="action")
    return cafes, violations


# -------------------------------------------------------- neighbourhoods
def load_ntas() -> tuple[pd.DataFrame, list, dict]:
    gj = json.loads((RAW / "ntas.geojson").read_text())
    rows, geoms = [], []
    for f in gj["features"]:
        p = f["properties"]
        rows.append({"nta": p["nta2020"], "name": p["ntaname"], "borough": p["boroname"], "cdta": p["cdta2020"],
                     "residential": p["ntatype"] == "0"})
        geoms.append(shape(f["geometry"]))
    return pd.DataFrame(rows), geoms, gj


def assign(points: pd.DataFrame, ntas: pd.DataFrame, geoms: list) -> pd.Series:
    tree = STRtree(geoms)
    out = []
    for lon, lat in zip(points["lon"], points["lat"]):
        pt = Point(lon, lat)
        hit = [i for i in tree.query(pt) if geoms[i].contains(pt)]
        out.append(ntas.iloc[hit[0]]["nta"] if hit else None)
    return pd.Series(out, index=points.index)


def load_subway(ntas, geoms) -> tuple[pd.DataFrame, pd.DataFrame]:
    raw = json.loads((RAW / "subway.json").read_text())
    df = pd.DataFrame(raw["rows"])
    df["riders"] = pd.to_numeric(df["riders"])
    df["hour"] = df["hour"].astype(int)
    for c in ("latitude", "longitude"):
        df[c] = pd.to_numeric(df[c])
    days = {"weekday": np.busday_count(raw["start"], raw["end"]),
            "weekend": (pd.Timestamp(raw["end"]) - pd.Timestamp(raw["start"])).days - np.busday_count(raw["start"], raw["end"])}
    df["per_day"] = df["riders"] / df["day_type"].map(days)
    st = (df.groupby(["station_complex_id", "station_complex", "borough", "latitude", "longitude", "day_type"])["per_day"]
            .sum().unstack(fill_value=0).reset_index().rename(columns={"latitude": "lat", "longitude": "lon"}))
    st["nta"] = assign(st, ntas, geoms)
    hourly = (df[df["day_type"] == "weekday"].groupby(["station_complex_id", "hour"])["per_day"].sum().reset_index())
    hourly = hourly.merge(st[["station_complex_id", "nta"]], on="station_complex_id")
    return st, hourly


def load_income(ntas: pd.DataFrame) -> pd.DataFrame:
    rows = json.loads((RAW / "income.json").read_text())
    by_cd = {}
    for r in rows:
        boro = r["cd"][:2]
        for num in re.findall(r"\d+", r["cd"]):
            by_cd[f"{boro}{int(num):02d}"] = (float(r["median_income"]), float(r["nyc_poverty_rate"]), r["neighborhoods"])
    out = ntas[["nta", "cdta"]].copy()
    out["median_income"] = out["cdta"].map(lambda c: by_cd.get(c, (np.nan,))[0])
    out["poverty_rate"] = out["cdta"].map(lambda c: by_cd.get(c, (np.nan, np.nan))[1])
    return out[["nta", "median_income", "poverty_rate"]]


def pct_rank(s: pd.Series, invert: bool = False) -> pd.Series:
    r = s.rank(pct=True, method="average")
    return ((1 - r) if invert else r).mul(100).round(0)


def build_neighbourhoods(cafes, ntas, stations, hourly, income) -> pd.DataFrame:
    coffee = cafes[cafes["segment"] == "coffee"]
    g = ntas.set_index("nta")
    g["coffee_shops"] = coffee.groupby("nta").size()
    g["chain_coffee"] = coffee[coffee["chain"]].groupby("nta").size()
    g["tea_shops"] = cafes[cafes["segment"] == "tea"].groupby("nta").size()
    g["bakeries_donuts_juice"] = cafes[cafes["segment"].isin(["bakery", "donuts", "juice"])].groupby("nta").size()
    g["new_coffee_shops"] = coffee[coffee["opened_recently"]].groupby("nta").size()
    graded = coffee[coffee["grade"].notna()]
    g["grade_a_share"] = graded.groupby("nta")["grade"].apply(lambda s: (s == "A").mean())
    g["closures_per_cafe"] = coffee.groupby("nta")["dohmh_closures"].mean()
    g["stations"] = stations.groupby("nta").size()
    g["weekday_riders"] = stations.groupby("nta")["weekday"].sum()
    g["weekend_riders"] = stations.groupby("nta")["weekend"].sum()
    sf = pd.DataFrame(json.loads((RAW / "storefronts.json").read_text())["rows"])
    sf[["storefronts", "vacant"]] = sf[["storefronts", "vacant"]].apply(pd.to_numeric)
    g = g.join(sf.set_index("nta")[["storefronts", "vacant"]])
    g = g.join(income.set_index("nta"))
    for c in ("coffee_shops", "chain_coffee", "tea_shops", "bakeries_donuts_juice", "new_coffee_shops", "stations",
              "weekday_riders", "weekend_riders", "storefronts", "vacant"):
        g[c] = g[c].fillna(0)
    g["independent_coffee"] = g["coffee_shops"] - g["chain_coffee"]
    g["independent_share"] = np.where(g["coffee_shops"] > 0, g["independent_coffee"] / g["coffee_shops"].clip(lower=1), np.nan)
    g["vacancy_rate"] = np.where(g["storefronts"] > 0, g["vacant"] / g["storefronts"].clip(lower=1), np.nan)
    g["growth_rate"] = np.where(g["coffee_shops"] > 0, g["new_coffee_shops"] / g["coffee_shops"].clip(lower=1), 0)
    # people passing per coffee shop: high = under-served
    g["riders_per_cafe"] = (g["weekday_riders"] / (g["coffee_shops"] + 1)).round(0)

    # hourly weekday profile -> when is the area busiest?
    prof = hourly.groupby(["nta", "hour"])["per_day"].sum().unstack(fill_value=0)
    # Station *entries*: in home areas people enter in the morning (going to work); in work areas they
    # enter in the evening (going home), having arrived in the morning. Both mean a morning coffee crowd.
    morning = prof[[6, 7, 8, 9]].sum(axis=1)
    evening = prof[[16, 17, 18, 19]].sum(axis=1)
    g["morning_share"] = (morning / prof.sum(axis=1)).round(3)
    g["evening_share"] = (evening / prof.sum(axis=1)).round(3)
    ratio = morning / evening.clip(lower=1)
    g["area_type"] = pd.Series(np.select([ratio >= 1.3, ratio <= 0.77], ["home", "work"], "mixed"), index=prof.index)
    g["hourly_profile"] = prof.apply(lambda r: [int(round(v)) for v in r.reindex(range(24), fill_value=0)], axis=1)

    # scores (0-100 percentile among residential neighbourhoods with any activity)
    r = g[g["residential"]]
    sc = pd.DataFrame(index=r.index)
    sc["foot_traffic"] = pct_rank(np.log1p(r["weekday_riders"] + 20 * r["storefronts"]))
    # competition: customers per café AND how many cafés there are at all (222 cafés is never "low competition")
    per_cafe = pct_rank(np.log1p(r["riders_per_cafe"] + 20 * r["storefronts"] / (r["coffee_shops"] + 1)))
    sc["low_competition"] = (0.5 * per_cafe + 0.5 * pct_rank(r["coffee_shops"], invert=True)).round(0)
    sc["spending_power"] = pct_rank(r["median_income"])
    sc["growing_scene"] = pct_rank(r["new_coffee_shops"] + r["growth_rate"])
    sc["available_space"] = pct_rank(r["vacant"])
    sc["independent_friendly"] = pct_rank(r["independent_share"].fillna(r["independent_share"].median()))
    g = g.join(sc.add_prefix("score_"))
    return g.reset_index()


# ------------------------------------------------------------------ write
def _clean(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        return None if np.isnan(v) else round(float(v), 4)
    if isinstance(v, (pd.Timestamp,)):
        return None if pd.isna(v) else v.strftime("%Y-%m-%d")
    if v is pd.NaT:
        return None
    return v


def records(df: pd.DataFrame) -> list[dict]:
    return [{k: _clean(v) for k, v in row.items()} for row in df.to_dict("records")]


def simplify_geojson(gj: dict, keep: set) -> dict:
    feats = []
    for f in gj["features"]:
        geom = shape(f["geometry"]).simplify(0.0004, preserve_topology=True)
        def rnd(c):
            return [rnd(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 4), round(c[1], 4)]
        g = geom.__geo_interface__
        feats.append({"type": "Feature", "properties": {"nta": f["properties"]["nta2020"]},
                      "geometry": {"type": g["type"], "coordinates": rnd(g["coordinates"])}})
    return {"type": "FeatureCollection", "features": feats}


def build() -> dict:
    cafes, violations = load_cafes()
    ntas, geoms, gj = load_ntas()
    cafes["nta"] = assign(cafes, ntas, geoms)
    cafes = cafes[cafes["nta"].notna()]
    stations, hourly = load_subway(ntas, geoms)
    income = load_income(ntas)
    hoods = build_neighbourhoods(cafes, ntas, stations, hourly, income)

    DB.parent.mkdir(parents=True, exist_ok=True)
    if DB.exists():
        DB.unlink()
    with sqlite3.connect(DB) as con:
        c = cafes.copy()
        for col in ("first_seen", "last_inspection", "opened_date"):
            c[col] = c[col].dt.strftime("%Y-%m-%d")
        c.to_sql("cafes", con, index=False)
        hoods.drop(columns=["hourly_profile"]).to_sql("neighbourhoods", con, index=False)
        stations.to_sql("stations", con, index=False)
        v = violations.copy()
        v["inspection_date"] = v["inspection_date"].dt.strftime("%Y-%m-%d")
        v.to_sql("violations", con, index=False)

    WEB.mkdir(parents=True, exist_ok=True)
    (WEB / "neighbourhoods.json").write_text(json.dumps(records(hoods.drop(columns=["cdta"]))))
    cafe_cols = ["name", "brand_name", "segment", "chain", "grade", "lat", "lon", "nta", "opened_recently", "address"]
    (WEB / "cafes.json").write_text(json.dumps(records(cafes[cafe_cols].round({"lat": 5, "lon": 5}))))
    (WEB / "stations.json").write_text(json.dumps(records(
        stations[["station_complex", "lat", "lon", "weekday", "weekend", "nta"]].round({"weekday": 0, "weekend": 0}))))
    (WEB / "map.json").write_text(json.dumps(simplify_geojson(gj, set(hoods["nta"]))))
    meta = {"as_of": AS_OF.strftime("%Y-%m-%d"), "recent_months": RECENT_MONTHS,
            "subway_period": [json.loads((RAW / "subway.json").read_text())[k] for k in ("start", "end")],
            "storefront_year": json.loads((RAW / "storefronts.json").read_text())["year"],
            "counts": {"cafes": int((cafes["segment"] == "coffee").sum()), "all_places": len(cafes),
                       "neighbourhoods": int(hoods["residential"].sum()), "stations": len(stations)}}
    return {"cafes": cafes, "violations": violations, "hoods": hoods, "stations": stations, "meta": meta}


if __name__ == "__main__":
    out = build()
    print(json.dumps(out["meta"], indent=2))
