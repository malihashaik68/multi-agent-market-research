"""Tools the agents share: a read-only SQL connection to the café database.

The LLM never computes numbers. Agents get every number from SQL/pandas, and each finding keeps the SQL
that produced it, so the fact-checker can re-run it.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

DB = Path(__file__).resolve().parents[1] / "data" / "nyc_cafes.db"
_ALLOWED = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION}


def _authorizer(action, *_):
    return sqlite3.SQLITE_OK if action in _ALLOWED else sqlite3.SQLITE_DENY


def connect(path: Path | str = DB) -> sqlite3.Connection:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    con.set_authorizer(_authorizer)  # read-only: INSERT/UPDATE/DELETE/DROP/ATTACH are refused
    return con


def sql(query: str, con: sqlite3.Connection | None = None) -> pd.DataFrame:
    if ";" in query.strip().rstrip(";"):
        raise ValueError("Only one SQL statement is allowed.")
    own = con is None
    con = con or connect()
    try:
        return pd.read_sql_query(query, con)
    finally:
        if own:
            con.close()


def scalar(query: str, con=None):
    df = sql(query, con)
    v = df.iloc[0, 0] if len(df) else None
    return None if pd.isna(v) else (round(float(v), 4) if isinstance(v, float) else v)
