import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { SCORE_INFO, SCORE_KEYS, type Hood, useData, fmt, money, pct, rankHoods, areaType } from "../lib/data";
import { Section, ScoreBadge } from "../components/UI";

function Picker({ value, onChange, hoods }: { value: string; onChange: (v: string) => void; hoods: Hood[] }) {
  return (
    <select className="input font-display text-lg" value={value} onChange={(e) => onChange(e.target.value)}>
      {["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"].map((b) => (
        <optgroup key={b} label={b}>
          {hoods.filter((h) => h.borough === b && h.residential).sort((x, y) => x.name.localeCompare(y.name))
            .map((h) => <option key={h.nta} value={h.nta}>{h.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

const ROWS: { label: string; get: (h: Hood) => number | null; show: (h: Hood) => string; better: "high" | "low" | null }[] = [
  { label: "Coffee shops", get: (h) => h.coffee_shops, show: (h) => fmt(h.coffee_shops), better: "low" },
  { label: "…of which chains", get: (h) => h.chain_coffee, show: (h) => fmt(h.chain_coffee), better: null },
  { label: "Weekday subway entries", get: (h) => h.weekday_riders, show: (h) => fmt(h.weekday_riders), better: "high" },
  { label: "Riders per café", get: (h) => h.riders_per_cafe, show: (h) => fmt(h.riders_per_cafe), better: "high" },
  { label: "Weekend vs weekday traffic", get: (h) => (h.weekday_riders ? h.weekend_riders / h.weekday_riders : null), show: (h) => (h.weekday_riders ? pct(h.weekend_riders / h.weekday_riders) : "–"), better: "high" },
  { label: "Empty storefronts", get: (h) => h.vacant, show: (h) => fmt(h.vacant), better: "high" },
  { label: "New coffee shops (24 mo)", get: (h) => h.new_coffee_shops, show: (h) => fmt(h.new_coffee_shops), better: null },
  { label: "Median resident income", get: (h) => h.median_income, show: (h) => money(h.median_income), better: "high" },
  { label: "Independent share", get: (h) => h.independent_share, show: (h) => pct(h.independent_share), better: "high" },
];

export default function Compare() {
  const { hoods, analysis } = useData();
  const [params] = useSearchParams();
  const picks = analysis.recommendation.data.picks;
  const [a, setA] = useState(params.get("a") ?? picks[0].nta);
  const [b, setB] = useState(params.get("b") ?? (picks[1].nta === a ? picks[0].nta : picks[1].nta));
  const ranked = useMemo(() => rankHoods(hoods, analysis.weights), [hoods, analysis.weights]);
  const ha = hoods.find((h) => h.nta === a)!, hb = hoods.find((h) => h.nta === b)!;
  const sa = ranked.find((r) => r.hood.nta === a)?.score ?? 0, sb = ranked.find((r) => r.hood.nta === b)?.score ?? 0;
  const winner = sa === sb ? null : sa > sb ? ha : hb;
  const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i < 12 ? `${i || 12}a` : `${i === 12 ? 12 : i - 12}p`,
    [ha.name]: ha.hourly_profile?.[i] ?? 0, [hb.name]: hb.hourly_profile?.[i] ?? 0 }));
  const wins = (row: (typeof ROWS)[number], h: Hood, o: Hood) => {
    const x = row.get(h), y = row.get(o);
    if (row.better == null || x == null || y == null || x === y) return false;
    return row.better === "high" ? x > y : x < y;
  };
  const strengths = (h: Hood, o: Hood) => SCORE_KEYS.filter((k) => (h[`score_${k}`] ?? 0) - (o[`score_${k}`] ?? 0) >= 15).map((k) => SCORE_INFO[k].label.toLowerCase());

  return (
    <div className="fade-in pt-12">
      <Section eyebrow="Side by side" title="Compare two neighbourhoods">
        <div className="grid md:grid-cols-2 gap-4">
          {[[a, setA, ha, sa], [b, setB, hb, sb]].map(([v, set, h, s]: any, i) => (
            <div key={i} className={`card p-5 ${winner?.nta === h.nta ? "ring-2 ring-caramel" : ""}`}>
              <Picker value={v} onChange={set} hoods={hoods} />
              <div className="mt-4 flex items-center gap-4">
                <ScoreBadge score={s} size="lg" />
                <div>
                  <div className="text-sm text-espresso/60">{h.borough} · {areaType(h).label}</div>
                  <Link to={`/n/${h.nta}`} className="font-display text-xl font-semibold hover:text-caramel-dark">{h.name}</Link>
                  {winner?.nta === h.nta && <div className="text-sm text-caramel-dark font-medium">★ Better overall match</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 card p-6 bg-gradient-to-br from-caramel-light/30 to-cream-paper">
          <div className="eyebrow mb-1">🧑‍💼 The advisor's take</div>
          <p className="text-lg leading-relaxed">
            {winner ? <><b>{winner.name}</b> is the better overall match ({Math.round(Math.max(sa, sb))} vs {Math.round(Math.min(sa, sb))}). </> : "They're an even match. "}
            {strengths(ha, hb).length > 0 && <>{ha.name} is stronger on {strengths(ha, hb).join(", ")}. </>}
            {strengths(hb, ha).length > 0 && <>{hb.name} is stronger on {strengths(hb, ha).join(", ")}. </>}
            Choose based on the kind of café you want: {areaType(ha).label.toLowerCase()} vs {areaType(hb).label.toLowerCase()}.
          </p>
        </div>

        <div className="mt-6 card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-dark/70">
              <tr><th className="text-left p-3 font-semibold">Measure</th><th className="p-3 text-right font-semibold">{ha.name}</th><th className="p-3 text-right font-semibold">{hb.name}</th></tr>
            </thead>
            <tbody>
              {SCORE_KEYS.map((k) => (
                <tr key={k} className="border-t border-espresso/5">
                  <td className="p-3">{SCORE_INFO[k].icon} {SCORE_INFO[k].label} <span className="text-espresso/50">(score)</span></td>
                  {[ha, hb].map((h, i) => {
                    const o = i ? ha : hb; const win = (h[`score_${k}`] ?? 0) > (o[`score_${k}`] ?? 0);
                    return <td key={i} className={`p-3 text-right tabular-nums ${win ? "font-bold text-sage-dark" : ""}`}>{Math.round(h[`score_${k}`] ?? 0)}</td>;
                  })}
                </tr>
              ))}
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-espresso/5">
                  <td className="p-3">{row.label}</td>
                  <td className={`p-3 text-right tabular-nums ${wins(row, ha, hb) ? "font-bold text-sage-dark" : ""}`}>{row.show(ha)}</td>
                  <td className={`p-3 text-right tabular-nums ${wins(row, hb, ha) ? "font-bold text-sage-dark" : ""}`}>{row.show(hb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 card p-6">
          <h3 className="text-xl font-semibold mb-3">Foot traffic through the day</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hourly} margin={{ left: -10, right: 10 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: "none", background: "#FBF7F1" }} />
              <Legend />
              <Line type="monotone" dataKey={ha.name} stroke="#A86E3E" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey={hb.name} stroke="#5F6F52" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}
