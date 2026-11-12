"""Download the public datasets (NYC Open Data and NY State Open Data). No API key needed.

Raw files are cached in data/raw/ so the pipeline can be re-run offline.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
NYC = "https://data.cityofnewyork.us/resource"
NYS = "https://data.ny.gov/resource"

# Restaurant inspections (DOHMH): every food business in NYC, inspected regularly.
INSPECTIONS = f"{NYC}/43nn-pn8j.json"
CAFE_WHERE = ("boro != '0' AND (cuisine_description in ('Coffee/Tea','Donuts','Bakery Products/Desserts',"
              "'Juice, Smoothies, Fruit Salads') OR upper(dba) like '%COFFEE%' OR upper(dba) like '%CAFE%' "
              "OR upper(dba) like '%ESPRESSO%' OR upper(dba) like '%CAFFE%')")
INSPECTION_COLS = ("camis,dba,boro,building,street,zipcode,cuisine_description,inspection_date,inspection_type,"
                   "action,violation_code,violation_description,critical_flag,score,grade,latitude,longitude")


def _get(url: str, params: dict, timeout: int = 180, retries: int = 5) -> list | dict:
    """GET with retries: the open-data portals sometimes return 5xx for a minute."""
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=timeout)
            if r.status_code < 500:
                r.raise_for_status()
                return r.json()
            err = requests.HTTPError(f"{r.status_code} from {url.split('/resource')[0]}")
        except (requests.ConnectionError, requests.Timeout) as exc:
            err = exc
        time.sleep(10 * 2 ** attempt)
    raise err


def _paged(url: str, params: dict, page: int = 50000, order: str = ":id") -> list[dict]:
    rows, offset = [], 0
    while True:
        batch = _get(url, {**params, "$limit": page, "$offset": offset, "$order": order})
        rows += batch
        if len(batch) < page:
            return rows
        offset += page


def _save(name: str, data) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / name
    path.write_text(json.dumps(data))
    n = len(data) if isinstance(data, list) else len(data.get("rows", data.get("features", [])))
    print(f"saved {path.name}: {n} records")
    return path


def fetch_cafes() -> Path:
    return _save("inspections.json", _paged(INSPECTIONS, {"$select": INSPECTION_COLS, "$where": CAFE_WHERE}))


def fetch_neighbourhoods() -> Path:
    """2020 Neighborhood Tabulation Areas (boundaries + names)."""
    return _save("ntas.geojson", _get(f"{NYC}/9nt8-h7nd.geojson", {"$limit": 1000}))


def fetch_storefronts(year: str = "2025") -> Path:
    """Storefront registry: how many ground-floor storefronts each neighbourhood has, and how many are vacant."""
    rows = _get(f"{NYC}/92iy-9c3n.json", {
        "$select": "nta, count(*) as storefronts, sum(case(vacant_6_30_or_date_sold='YES',1,true,0)) as vacant",
        "$where": f"reporting_year='{year}'", "$group": "nta", "$limit": 5000})
    return _save("storefronts.json", {"year": year, "rows": rows})


def fetch_subway(start: str = "2026-07-01", end: str = "2026-10-01") -> Path:
    """MTA hourly subway entries, summed per station and hour, split weekday / weekend."""
    rows = []
    dow = "date_extract_dow(transit_timestamp)"
    for label, days in (("weekday", f"{dow} between 1 and 5"), ("weekend", f"({dow} = 0 OR {dow} = 6)")):
        where = f"transit_timestamp between '{start}' and '{end}' AND {days}"
        batch = _paged(f"{NYS}/5wq4-mkjj.json", {
            "$select": "station_complex_id, station_complex, borough, latitude, longitude, "
                       "date_extract_hh(transit_timestamp) as hour, sum(ridership) as riders",
            "$where": where,
            "$group": "station_complex_id, station_complex, borough, latitude, longitude, hour"},
            order="station_complex_id, hour")
        rows += [{**r, "day_type": label} for r in batch]
    return _save("subway.json", {"start": start, "end": end, "rows": rows})


def fetch_income() -> Path:
    """Median household income and poverty rate by community district (NYC Neighborhood Financial Health, 2020)."""
    rows = _get(f"{NYC}/r3dx-pew9.json", {
        "$select": "distinct cd, neighborhoods, median_income, nyc_poverty_rate, year_published"})
    return _save("income.json", rows)


def fetch_all() -> None:
    for fn in (fetch_neighbourhoods, fetch_cafes, fetch_storefronts, fetch_subway, fetch_income):
        fn()


def fetch_missing() -> None:
    names = {"ntas.geojson": fetch_neighbourhoods, "inspections.json": fetch_cafes, "storefronts.json": fetch_storefronts,
             "subway.json": fetch_subway, "income.json": fetch_income}
    for name, fn in names.items():
        if not (RAW / name).exists():
            fn()


if __name__ == "__main__":
    import sys
    fetch_all() if "--all" in sys.argv else fetch_missing()
