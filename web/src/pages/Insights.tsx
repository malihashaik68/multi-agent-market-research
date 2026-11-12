import { Link } from "react-router-dom";
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useData, fmt } from "../lib/data";
import { PRACTICES, WHY_CAFES_STRUGGLE } from "../lib/knowledge";
import { Section, Stat } from "../components/UI";

export default function Insights() {
  const { analysis } = useData();
  const { operations: ops, trend, competitor, location } = analysis.reports;
  const get = (r: typeof ops, id: string) => r.findings.find((f) => f.id === id)?.value as number;
  // drop the first and last quarters: they are only partly covered by the 24-month window
  const quarters = (trend.data.by_quarter as { quarter: string; independent: number; chain: number }[]).slice(1, -1);
  const chainShare = get(competitor, "chain_share");
  const pie = [{ name: "Independent", value: 1 - chainShare }, { name: "Chains", value: chainShare }];

  return (
    <div className="fade-in pt-12 space-y-20">
      <Section eyebrow="What works, what fails" title="Lessons from 3,000+ New York coffee shops"
               intro="The Operations, Trend and Competitor agents studied health inspections, new openings and the chains, then turned them into lessons you can use.">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon="🅰️" value={`${Math.round(get(ops, "grade_a_share") * 100)}%`} label="of coffee shops hold an A health grade" tone="sage" />
          <Stat icon="🚫" value={`${Math.round(get(ops, "closure_share") * 100)}%`} label="were temporarily closed by inspectors at least once" tone="terracotta" />
          <Stat icon="🌱" value={fmt(get(trend, "new_total"))} label="new coffee shops in 24 months" />
          <Stat icon="🏡" value={`${Math.round(get(trend, "new_independent_share") * 100)}%`} label="of new openings are independent" tone="cream" />
        </div>
        <div className="mt-6 card p-6 bg-gradient-to-br from-sage-light/50 to-cream-paper">
          <div className="eyebrow mb-1">✅ Operations Analyst</div>
          <p className="text-lg leading-relaxed">{ops.summary}</p>
        </div>
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {(ops.data.lessons as { title: string; text: string; source: string }[]).map((l) => (
            <div key={l.title} className="card p-6">
              <h3 className="text-xl font-semibold">{l.title}</h3>
              <p className="mt-2 text-espresso/75 leading-relaxed">{l.text}</p>
              <div className="mt-3 text-xs text-espresso/50">Source: {l.source}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Avoid these" title="The health problems inspectors find most in cafés"
               intro="Number of NYC coffee shops cited at least once for each critical violation, with a simple way to prevent it.">
        <div className="card divide-y divide-espresso/5">
          {(ops.data.top_violations as { code: string; description: string; cafes: number; tip: string }[]).map((v) => {
            const max = ops.data.top_violations[0].cafes;
            return (
              <div key={v.code} className="p-4 sm:p-5 grid sm:grid-cols-[1fr_220px] gap-3 items-center">
                <div>
                  <div className="font-medium">{v.tip ? v.tip.split(":")[0] : v.description}</div>
                  <div className="text-sm text-espresso/65">{v.tip ? v.tip.split(":").slice(1).join(":").trim() : ""}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 flex-1 rounded-full bg-espresso/10"><div className="h-full rounded-full bg-terracotta" style={{ width: `${(v.cafes / max) * 100}%` }} /></div>
                  <span className="text-sm tabular-nums w-14 text-right">{fmt(v.cafes)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section eyebrow="Trends" title="Who's opening, and where" intro={trend.summary}>
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">New coffee shops per quarter</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={quarters} margin={{ left: -15 }}>
                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", background: "#FBF7F1" }} />
                <Legend />
                <Bar dataKey="independent" name="Independent" stackId="a" fill="#C68B59" radius={[0, 0, 0, 0]} />
                <Bar dataKey="chain" name="Chain" stackId="a" fill="#5F6F52" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-espresso/50 mt-2">A café counts as new when the Health Department did its pre-opening inspection in the period. Partly-covered quarters are left out.</p>
          </div>
          <div className="card p-6">
            <h3 className="text-lg font-semibold">Chains vs independents today</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pie} dataKey="value" innerRadius={50} outerRadius={78} paddingAngle={3}>
                  <Cell fill="#C68B59" /><Cell fill="#5F6F52" />
                </Pie>
                <Tooltip formatter={(v: number) => `${Math.round(v * 100)}%`} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="text-sm space-y-1.5">
              {(competitor.data.brands as { brand: string; n: number }[]).slice(0, 6).map((b) => (
                <li key={b.brand} className="flex justify-between"><span>{b.brand}</span><b className="tabular-nums">{fmt(b.n)}</b></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-1">🟢 Busy but under-served</h3>
            <p className="text-sm text-espresso/60 mb-3">Lots of subway riders for each coffee shop.</p>
            {(competitor.data.underserved as any[]).map((h) => (
              <Link key={h.nta} to={`/n/${h.nta}`} className="flex justify-between py-1.5 border-b border-espresso/5 hover:text-caramel-dark">
                <span>{h.name} <span className="text-espresso/50 text-sm">{h.borough}</span></span><b className="tabular-nums">{fmt(h.riders_per_cafe)}</b>
              </Link>
            ))}
          </div>
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-1">🔴 Crowded</h3>
            <p className="text-sm text-espresso/60 mb-3">Few riders for each coffee shop: customers are split many ways.</p>
            {(competitor.data.crowded as any[]).map((h) => (
              <Link key={h.nta} to={`/n/${h.nta}`} className="flex justify-between py-1.5 border-b border-espresso/5 hover:text-caramel-dark">
                <span>{h.name} <span className="text-espresso/50 text-sm">{h.borough}</span></span><b className="tabular-nums">{fmt(h.riders_per_cafe)}</b>
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm text-espresso/60">📍 {location.summary}</p>
      </Section>

      <Section eyebrow="Running a café" title="What successful cafés do"
               intro="Practical guidance from public small-business sources. The agents add the New York data on top.">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRACTICES.map((p) => (
            <div key={p.title} className="card p-6">
              <div className="text-3xl">{p.icon}</div>
              <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm text-espresso/75 leading-relaxed">{p.text}</p>
              <div className="mt-3 text-xs text-espresso/50">
                {p.url ? <a className="underline hover:text-espresso" href={p.url} target="_blank" rel="noreferrer">{p.source}</a> : p.source}
              </div>
            </div>
          ))}
        </div>
        <h3 className="mt-12 text-2xl font-semibold">Why cafés struggle</h3>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WHY_CAFES_STRUGGLE.map((w, i) => (
            <div key={w.title} className="rounded-2xl border border-terracotta/25 bg-terracotta-light/20 p-5">
              <div className="font-display text-terracotta text-2xl">{i + 1}</div>
              <div className="font-semibold">{w.title}</div>
              <p className="text-sm text-espresso/70 mt-1">{w.text}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
