import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, RotateCcw, Scale } from "lucide-react";
import { BOROUGHS, SCORE_INFO, SCORE_KEYS, type ScoreKey, rankHoods, useData, fmt, areaType } from "../lib/data";
import NycMap, { MapLegend } from "../components/NycMap";
import { Section, Weights, ScoreBadge, Pill } from "../components/UI";

const PRESETS: { label: string; hint: string; w: Record<ScoreKey, number> }[] = [
  { label: "Balanced", hint: "The agents' default", w: { foot_traffic: 0.3, low_competition: 0.25, available_space: 0.15, spending_power: 0.1, growing_scene: 0.1, independent_friendly: 0.1 } },
  { label: "First-time owner", hint: "Less competition, independent-friendly", w: { foot_traffic: 0.2, low_competition: 0.35, available_space: 0.15, spending_power: 0.05, growing_scene: 0.05, independent_friendly: 0.2 } },
  { label: "Commuter rush", hint: "Maximum people passing by", w: { foot_traffic: 0.5, low_competition: 0.2, available_space: 0.1, spending_power: 0.1, growing_scene: 0.1, independent_friendly: 0 } },
  { label: "Cosy local spot", hint: "Few cafés, residents with spending power", w: { foot_traffic: 0.1, low_competition: 0.35, available_space: 0.15, spending_power: 0.25, growing_scene: 0, independent_friendly: 0.15 } },
];

export default function Explore() {
  const { hoods, map, analysis } = useData();
  const nav = useNavigate();
  const [weights, setWeights] = useState<Record<ScoreKey, number>>(analysis.weights);
  const [borough, setBorough] = useState("All");
  const [preset, setPreset] = useState("Balanced");
  const [view, setView] = useState<"overall" | ScoreKey>("overall");

  const ranked = useMemo(() => rankHoods(hoods, weights, borough), [hoods, weights, borough]);
  const all = useMemo(() => rankHoods(hoods, weights), [hoods, weights]);
  const values = useMemo(() => Object.fromEntries(
    all.map((r) => [r.hood.nta, view === "overall" ? r.score : r.hood[`score_${view}`] ?? 0])), [all, view]);
  const top = ranked.slice(0, 10);

  return (
    <div className="fade-in pt-12">
      <Section eyebrow="Where to open" title="Find the neighbourhood that fits your café"
               intro="Tell the agents what matters most to you. The map and ranking update instantly. Darker means a better match.">
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          {/* controls */}
          <aside className="card p-5 h-fit lg:sticky lg:top-20 space-y-6">
            <div>
              <div className="font-semibold mb-2">Start from</div>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button key={p.label} title={p.hint} onClick={() => { setWeights(p.w); setPreset(p.label); }}
                          className={`rounded-xl px-3 py-2 text-sm text-left transition border ${preset === p.label ? "bg-espresso text-cream border-espresso" : "border-espresso/15 hover:bg-espresso/5"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2">Borough</div>
              <select className="input" value={borough} onChange={(e) => setBorough(e.target.value)}>
                {BOROUGHS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">What matters to you</div>
                <button className="text-xs flex items-center gap-1 text-espresso/60 hover:text-espresso"
                        onClick={() => { setWeights(analysis.weights); setPreset("Balanced"); }}><RotateCcw size={12} /> reset</button>
              </div>
              <Weights weights={weights} onChange={(w) => { setWeights(w); setPreset("Custom"); }} />
            </div>
          </aside>

          <div className="space-y-6 min-w-0">
            <div className="card p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-sm font-medium mr-1">Colour the map by</span>
                {(["overall", ...SCORE_KEYS] as const).map((k) => (
                  <button key={k} onClick={() => setView(k)}
                          className={`chip border transition ${view === k ? "bg-caramel text-cream border-caramel" : "border-espresso/15 hover:bg-espresso/5"}`}>
                    {k === "overall" ? "⭐ Overall match" : `${SCORE_INFO[k].icon} ${SCORE_INFO[k].label}`}
                  </button>
                ))}
              </div>
              <NycMap map={map} hoods={hoods} values={values} highlight={top.slice(0, 5).map((r) => r.hood.nta)}
                      onSelect={(nta) => nav(`/n/${nta}`)} className="max-w-[640px] mx-auto" />
              <div className="mt-3 flex flex-wrap justify-between gap-2 items-center">
                <MapLegend />
                <span className="text-xs text-espresso/60">Click a neighbourhood for the full report</span>
              </div>
            </div>

            <div>
              <div className="flex items-end justify-between mb-3">
                <h3 className="text-2xl font-semibold">Top 10 {borough !== "All" && <span className="text-caramel-dark">in {borough}</span>}</h3>
                <Link to="/compare" className="text-sm font-medium flex items-center gap-1 text-caramel-dark hover:underline"><Scale size={15} /> Compare two places</Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {top.map(({ hood: h, score }, i) => (
                  <Link key={h.nta} to={`/n/${h.nta}`} className="card p-4 flex gap-4 items-center hover:shadow-lift hover:-translate-y-0.5 transition group">
                    <span className="font-display text-2xl text-caramel/70 w-6 text-center">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold leading-tight truncate group-hover:text-caramel-dark">{h.name}</div>
                      <div className="text-xs text-espresso/60">{h.borough} · {areaType(h).label}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Pill>☕ {fmt(h.coffee_shops)} cafés</Pill>
                        <Pill tone="sage">🚇 {fmt(h.weekday_riders)} /day</Pill>
                      </div>
                    </div>
                    <ScoreBadge score={score} />
                  </Link>
                ))}
              </div>
              <Link to={`/n/${top[0]?.hood.nta}`} className="mt-5 btn-primary">Open #1: {top[0]?.hood.name} <ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
