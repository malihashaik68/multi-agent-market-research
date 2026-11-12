// Analytics for the private café dashboard. Pure functions (unit-tested), no network.

export type Entry = { date: string; customers: number; sales: number; expenses?: number | null; note?: string };

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dow = (d: string) => new Date(`${d}T12:00:00`).getDay();
export const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

export const sorted = (es: Entry[]) => [...es].sort((a, b) => a.date.localeCompare(b.date));

/** Sum of a field over the n days ending at `end` (inclusive), and the n days before that. */
export function periodCompare(es: Entry[], field: "customers" | "sales", n: number, end?: string) {
  const s = sorted(es);
  if (!s.length) return null;
  const last = end ?? s[s.length - 1].date;
  const start = addDays(last, -(n - 1)), prevStart = addDays(start, -n), prevEnd = addDays(start, -1);
  const cur = s.filter((e) => e.date >= start && e.date <= last);
  const prev = s.filter((e) => e.date >= prevStart && e.date <= prevEnd);
  const sum = (xs: Entry[]) => xs.reduce((a, e) => a + e[field], 0);
  const curAvg = cur.length ? sum(cur) / cur.length : 0, prevAvg = prev.length ? sum(prev) / prev.length : 0;
  return { current: sum(cur), previous: sum(prev), curDays: cur.length, prevDays: prev.length,
           change: prevAvg ? (curAvg - prevAvg) / prevAvg : null };
}

/** Linear trend of daily values (least squares on day index). Returns % change per 30 days relative to the mean. */
export function trend(es: Entry[], field: "customers" | "sales", lastDays = 56) {
  const s = sorted(es).slice(-lastDays);
  if (s.length < 14) return null;
  const t0 = new Date(`${s[0].date}T12:00:00`).getTime();
  const xs = s.map((e) => (new Date(`${e.date}T12:00:00`).getTime() - t0) / 86400000);
  // remove the weekday pattern first so a busy Saturday doesn't look like growth
  const wk = weekdayPattern(s, field);
  const overall = mean(s.map((e) => e[field])) || 1;
  const ys = s.map((e) => e[field] / ((wk[dow(e.date)] || overall) / overall));
  const mx = mean(xs), my = mean(ys);
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
  return { slopePerDay: slope, pctPer30: (slope * 30) / (my || 1), intercept: my - slope * mx, t0, mean: my };
}

export function status(es: Entry[]): { label: "Growing" | "Steady" | "Declining" | "Getting started"; detail: string } {
  const t = trend(es, "sales");
  if (!t) return { label: "Getting started", detail: "Add at least two weeks of days to see your trend." };
  const p = t.pctPer30;
  if (p > 0.03) return { label: "Growing", detail: `Sales are rising about ${Math.round(p * 100)}% a month (weekday pattern removed).` };
  if (p < -0.03) return { label: "Declining", detail: `Sales are falling about ${Math.round(-p * 100)}% a month (weekday pattern removed).` };
  return { label: "Steady", detail: "Sales are holding steady over the last 8 weeks." };
}

/** Average value per weekday (0 = Sunday). */
export function weekdayPattern(es: Entry[], field: "customers" | "sales") {
  const by: number[][] = Array.from({ length: 7 }, () => []);
  for (const e of es) by[dow(e.date)].push(e[field]);
  return by.map((xs) => (xs.length ? mean(xs) : 0));
}

export type Alert = { date: string; kind: "low" | "high" | "streak" | "breakeven" | "ticket"; text: string };

/** Unusual days: far from the normal level for that weekday (recent 8 weeks), plus streaks and break-even misses. */
export function alerts(es: Entry[], breakEvenSales = 0): Alert[] {
  const s = sorted(es);
  const out: Alert[] = [];
  for (let i = 0; i < s.length; i++) {
    const e = s[i];
    const same = s.slice(Math.max(0, i - 56), i).filter((x) => dow(x.date) === dow(e.date)).map((x) => x.sales);
    if (same.length >= 3) {
      const m = mean(same), sd = Math.max(std(same), m * 0.08);
      if (e.sales < m - 2 * sd) out.push({ date: e.date, kind: "low", text: `Sales $${Math.round(e.sales)} were well below a normal ${DAY_NAMES[dow(e.date)]} (~$${Math.round(m)}).${e.note ? ` Note: ${e.note}` : ""}` });
      else if (e.sales > m + 2 * sd) out.push({ date: e.date, kind: "high", text: `Great day: $${Math.round(e.sales)}, well above a normal ${DAY_NAMES[dow(e.date)]} (~$${Math.round(m)}).${e.note ? ` Note: ${e.note}` : ""}` });
    }
  }
  // 3+ weeks in a row of lower weekly sales
  const weeks = weeklyTotals(s);
  let run = 0;
  for (let i = 1; i < weeks.length; i++) {
    run = weeks[i].sales < weeks[i - 1].sales ? run + 1 : 0;
    if (run === 3) out.push({ date: weeks[i].week, kind: "streak", text: "Weekly sales have dropped three weeks in a row. Time to look at what changed." });
  }
  if (breakEvenSales > 0) {
    const recent = s.slice(-14);
    const below = recent.filter((e) => e.sales < breakEvenSales).length;
    if (recent.length >= 7 && below / recent.length > 0.5)
      out.push({ date: recent[recent.length - 1].date, kind: "breakeven", text: `${below} of the last ${recent.length} days were below your break-even of $${Math.round(breakEvenSales)} a day.` });
  }
  // average spend per customer falling
  const tk = periodCompare(s, "sales", 28), cu = periodCompare(s, "customers", 28);
  if (tk && cu && tk.curDays >= 14 && tk.prevDays >= 14 && cu.current && cu.previous) {
    const now = tk.current / cu.current, before = tk.previous / cu.previous;
    if (now < before * 0.95) out.push({ date: s[s.length - 1].date, kind: "ticket", text: `Average spend per customer fell from $${before.toFixed(2)} to $${now.toFixed(2)} over the last 4 weeks.` });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function weeklyTotals(es: Entry[]) {
  const map = new Map<string, { week: string; sales: number; customers: number; days: number }>();
  for (const e of sorted(es)) {
    const w = addDays(e.date, -((dow(e.date) + 6) % 7)); // Monday
    const cur = map.get(w) ?? { week: w, sales: 0, customers: 0, days: 0 };
    cur.sales += e.sales; cur.customers += e.customers; cur.days += 1;
    map.set(w, cur);
  }
  return [...map.values()];
}

/** Forecast the next n days: trend line x weekday pattern. */
export function forecast(es: Entry[], n = 30) {
  const s = sorted(es);
  const t = trend(s, "sales");
  if (!t || !s.length) return [];
  const wk = weekdayPattern(s.slice(-56), "sales");
  const overall = mean(s.slice(-56).map((e) => e.sales)) || 1;
  const last = s[s.length - 1].date;
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(last, i + 1);
    const x = (new Date(`${d}T12:00:00`).getTime() - t.t0) / 86400000;
    const base = t.intercept + t.slopePerDay * x;
    return { date: d, forecast: Math.max(0, Math.round(base * ((wk[dow(d)] || overall) / overall))) };
  });
}

export function movingAverage(es: Entry[], field: "sales" | "customers", window = 7) {
  const s = sorted(es);
  return s.map((e, i) => {
    const w = s.slice(Math.max(0, i - window + 1), i + 1);
    return { date: e.date, value: e[field], avg: w.length >= Math.min(window, 3) ? Math.round(mean(w.map((x) => x[field]))) : null };
  });
}

/** Plain-English advice from the patterns. */
export function advice(es: Entry[], breakEvenSales = 0): string[] {
  const s = sorted(es);
  if (s.length < 14) return ["Log every day for two weeks: the dashboard will then show trends, alerts and advice."];
  const tips: string[] = [];
  const wk = weekdayPattern(s.slice(-56), "sales");
  const open = wk.map((v, i) => ({ v, i })).filter((x) => x.v > 0);
  const worst = open.reduce((a, b) => (b.v < a.v ? b : a)), best = open.reduce((a, b) => (b.v > a.v ? b : a));
  if (best.v > worst.v * 1.25)
    tips.push(`${DAY_NAMES[worst.i]} is your slowest day (~$${Math.round(worst.v)} vs ~$${Math.round(best.v)} on ${DAY_NAMES[best.i]}). Try a ${DAY_NAMES[worst.i]} special or loyalty double-stamps, or schedule fewer staff.`);
  const st = status(s);
  if (st.label === "Declining") tips.push("Sales are trending down. Check what changed: a new competitor, prices, staff, opening hours or the weather. Ask a few regulars for honest feedback.");
  if (st.label === "Growing") tips.push("You're growing. Make sure staffing and stock keep up at peak times so service stays fast.");
  const cu = periodCompare(s, "customers", 28), sa = periodCompare(s, "sales", 28);
  if (cu && sa && cu.current) {
    const ticket = sa.current / cu.current;
    tips.push(`Average spend is $${ticket.toFixed(2)} per customer. Suggesting a pastry with every coffee raises it without new customers.`);
  }
  if (breakEvenSales > 0) {
    const last28 = s.slice(-28);
    const avg = mean(last28.map((e) => e.sales));
    tips.push(avg >= breakEvenSales
      ? `Over the last 4 weeks you averaged $${Math.round(avg)} a day, above your break-even of $${Math.round(breakEvenSales)}.`
      : `Over the last 4 weeks you averaged $${Math.round(avg)} a day, below your break-even of $${Math.round(breakEvenSales)}. Focus on your busiest hours and cut waste.`);
  }
  return tips;
}

/** Fictional sample data for the demo: about 4 months of a growing café with a weekday pattern. */
export function sampleData(days = 120, end = new Date().toISOString().slice(0, 10)): Entry[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pattern = [1.25, 0.78, 0.86, 0.92, 0.97, 1.08, 1.35]; // Sun..Sat
  const out: Entry[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const day = days - i;
    let customers = (110 + day * 0.45) * pattern[dow(date)] * (0.9 + rnd() * 0.2);
    let note: string | undefined;
    if (day === 47) { customers *= 0.45; note = "Snowstorm"; }
    if (day === 88) { customers *= 1.6; note = "Street fair"; }
    const ticket = 7.2 + rnd() * 0.9;
    out.push({ date, customers: Math.round(customers), sales: Math.round(customers * ticket), expenses: null, note });
  }
  return out;
}
