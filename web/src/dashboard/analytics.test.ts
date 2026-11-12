import { describe, expect, it } from "vitest";
import { type Entry, addDays, advice, alerts, forecast, periodCompare, sampleData, status, weekdayPattern } from "./analytics";
import { fromCSV, toCSV } from "./vault";

const flat = (days: number, perDay: (i: number) => number, start = "2026-01-05"): Entry[] =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), customers: 100, sales: perDay(i) }));

describe("dashboard analytics", () => {
  it("compares the last 7 days with the 7 before", () => {
    const es = flat(14, (i) => (i < 7 ? 1000 : 1100));
    const c = periodCompare(es, "sales", 7)!;
    expect(c.current).toBe(7700);
    expect(c.previous).toBe(7000);
    expect(c.change).toBeCloseTo(0.1, 5);
  });

  it("detects growth, decline and steady sales", () => {
    expect(status(flat(56, (i) => 1000 + i * 10)).label).toBe("Growing");
    expect(status(flat(56, (i) => 2000 - i * 15)).label).toBe("Declining");
    expect(status(flat(56, () => 1000)).label).toBe("Steady");
    expect(status(flat(5, () => 1000)).label).toBe("Getting started");
  });

  it("does not mistake a busy weekend for growth", () => {
    // same level every week, Saturdays double: should be steady
    const es = flat(56, (i) => (new Date(`${addDays("2026-01-05", i)}T12:00:00`).getDay() === 6 ? 2000 : 1000));
    expect(status(es).label).toBe("Steady");
    expect(weekdayPattern(es, "sales")[6]).toBe(2000);
  });

  it("flags an unusual day for its weekday", () => {
    const es = flat(42, () => 1000);
    es[40] = { ...es[40], sales: 300, note: "storm" };
    const a = alerts(es);
    expect(a.some((x) => x.kind === "low" && x.date === es[40].date && x.text.includes("storm"))).toBe(true);
  });

  it("warns when most recent days are below break-even", () => {
    expect(alerts(flat(20, () => 500), 800).some((a) => a.kind === "breakeven")).toBe(true);
    expect(alerts(flat(20, () => 900), 800).some((a) => a.kind === "breakeven")).toBe(false);
  });

  it("forecasts 30 days that follow the trend", () => {
    const f = forecast(flat(56, (i) => 1000 + i * 10), 30);
    expect(f).toHaveLength(30);
    expect(f[29].forecast).toBeGreaterThan(f[0].forecast);
  });

  it("gives advice about the slowest day", () => {
    const es = flat(56, (i) => (new Date(`${addDays("2026-01-05", i)}T12:00:00`).getDay() === 1 ? 500 : 1000));
    expect(advice(es).join(" ")).toContain("Mon is your slowest day");
  });

  it("sample data is fictional, deterministic and growing", () => {
    const a = sampleData(120, "2026-06-30"), b = sampleData(120, "2026-06-30");
    expect(a).toEqual(b);
    expect(a).toHaveLength(120);
    expect(status(a).label).toBe("Growing");
  });

  it("backup CSV round-trips", () => {
    const es = flat(3, () => 1234);
    es[1].note = "rain, cold";
    const back = fromCSV(toCSV(es));
    expect(back.map((e) => e.sales)).toEqual([1234, 1234, 1234]);
    expect(back[1].note).toBe("rain  cold");
  });
});
