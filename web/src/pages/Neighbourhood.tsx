import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Scale, Sparkles } from "lucide-react";
import { useData, fmt, pct, money, rankHoods, areaType } from "../lib/data";
import NycMap from "../components/NycMap";
import { HourlyChart, ScoreBadge, ScoreBars, Stat, Pill } from "../components/UI";

export default function Neighbourhood() {
  const { nta = "" } = useParams();
  const { hoods, cafes, map, analysis } = useData();
  const h = hoods.find((x) => x.nta === nta);
  const ranked = useMemo(() => rankHoods(hoods, analysis.weights), [hoods, analysis.weights]);
  if (!h) return <div className="p-20 text-center">Neighbourhood not found. <Link className="underline" to="/explore">Back</Link></div>;
  const pos = ranked.findIndex((r) => r.hood.nta === nta);
  const score = ranked[pos]?.score ?? 0;
  const local = cafes.filter((c) => c.nta === nta);
  const coffee = local.filter((c) => c.segment === "coffee");
  const pick = analysis.recommendation.data.picks.find((p) => p.nta === nta);
  const plan = analysis.plans[nta];
  const chains = Object.entries(coffee.filter((c) => c.chain).reduce<Record<string, number>>((a, c) => {
    a[c.brand_name] = (a[c.brand_name] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const newOnes = coffee.filter((c) => c.opened_recently && !c.chain).slice(0, 8);
  const values = Object.fromEntries(ranked.map((r) => [r.hood.nta, r.score]));

  return (
    <div className="fade-in pt-10 mx-auto max-w-6xl px-4 sm:px-6">
      <Link to="/explore" className="text-sm flex items-center gap-1 text-espresso/60 hover:text-espresso"><ArrowLeft size={14} /> All neighbourhoods</Link>
      <div className="mt-4 flex flex-wrap items-center gap-6 justify-between">
        <div>
          <div className="eyebrow">{h.borough} · {areaType(h).label}</div>
          <h1 className="mt-1 text-4xl sm:text-5xl font-semibold tracking-tight">{h.name}</h1>
          <p className="mt-2 text-espresso/70 max-w-xl">{areaType(h).text}</p>
        </div>
        <div className="flex items-center gap-4">
          <ScoreBadge score={score} size="lg" />
          <div className="text-sm text-espresso/70">Overall match<br /><b className="text-espresso">#{pos + 1}</b> of {ranked.length}</div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon="☕" value={fmt(h.coffee_shops)} label={`coffee shops (${fmt(h.chain_coffee)} chain, ${fmt(h.independent_coffee)} independent)`} />
        <Stat icon="🚇" value={fmt(h.weekday_riders)} label={`weekday subway entries, ${fmt(h.riders_per_cafe)} per café`} tone="sage" />
        <Stat icon="🏪" value={fmt(h.vacant)} label={`empty storefronts (of ${fmt(h.storefronts)})`} tone="cream" />
        <Stat icon="🌱" value={fmt(h.new_coffee_shops)} label={`new coffee shops in ${analysis.meta.recent_months} months`} tone="terracotta" />
      </div>

      {pick && (
        <div className="mt-6 card p-6 bg-gradient-to-br from-caramel-light/30 to-cream-paper">
          <div className="eyebrow mb-2">🧑‍💼 Why the Lead Advisor ranked it #{pick.rank}</div>
          <p className="text-lg leading-relaxed">{pick.why}</p>
          <div className="mt-2 text-xs text-espresso/50">{pick.written_by.startsWith("llm") ? "Written by the AI advisor, checked by the fact-checker" : "Built from verified numbers"}</div>
        </div>
      )}

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-xl font-semibold mb-4">How it scores</h3>
          <ScoreBars hood={h} />
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-cream-dark/70 p-3">Median resident income<br /><b className="text-lg">{money(h.median_income)}</b></div>
            <div className="rounded-2xl bg-cream-dark/70 p-3">Cafés with an A grade<br /><b className="text-lg">{pct(h.grade_a_share)}</b></div>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="text-xl font-semibold mb-2 px-2">Coffee shops here</h3>
          <NycMap map={map} hoods={hoods} values={values} cafes={local.filter((c) => c.segment === "coffee")} focus={nta} />
          <div className="flex gap-4 text-xs px-2 mt-2">
            <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-terracotta mr-1" />Independent</span>
            <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-sage-dark mr-1" />Chain</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="card p-6">
          <h3 className="text-xl font-semibold">When people pass by</h3>
          <p className="text-sm text-espresso/65 mb-3">Subway entries on a typical weekday, by hour ({analysis.meta.subway_period.join(" to ")}).</p>
          {h.hourly_profile && h.stations > 0 ? <HourlyChart profile={h.hourly_profile} /> :
            <div className="py-12 text-center text-espresso/60">No subway station here: customers come on foot, by bus or car.</div>}
        </div>
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-2">Chains nearby</h3>
            <div className="flex flex-wrap gap-2">{chains.length ? chains.map(([n, k]) => <Pill key={n}>{n} · {k}</Pill>) : <span className="text-sm text-espresso/60">No chain coffee shops.</span>}</div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">New independents</h3>
            <div className="flex flex-wrap gap-2">{newOnes.length ? newOnes.map((c) => <Pill key={c.name + c.address} tone="sage">{c.name}</Pill>) : <span className="text-sm text-espresso/60">None in the last two years.</span>}</div>
          </div>
        </div>
      </div>

      {plan && (
        <div className="mt-6 card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">🧾 Quick plan for a café here</h3>
            <div className="flex gap-2">
              <Link to={`/compare?a=${nta}`} className="btn-ghost text-sm"><Scale size={15} /> Compare</Link>
              <Link to={`/my-cafe?nta=${nta}`} className="btn-primary text-sm"><Sparkles size={15} /> Plan my café here <ArrowRight size={15} /></Link>
            </div>
          </div>
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
            <div><div className="font-semibold mb-1">Opening hours</div><ul className="space-y-1">{plan.hours.map((x) => <li key={x}>🕖 {x}</li>)}</ul></div>
            <div><div className="font-semibold mb-1">Stand out</div><ul className="space-y-1">{plan.stand_out.slice(0, 3).map((x) => <li key={x}>✨ {x}</li>)}</ul></div>
            <div><div className="font-semibold mb-1">Watch out</div><ul className="space-y-1">{plan.risks.slice(0, 3).map((x) => <li key={x}>⚠️ {x}</li>)}</ul></div>
          </div>
        </div>
      )}
    </div>
  );
}
