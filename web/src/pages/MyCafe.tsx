import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Calculator, Palette, Sparkles } from "lucide-react";
import { useData, fmt, money, areaType } from "../lib/data";
import { FloorPlan, Storefront } from "../components/Illustrations";
import { Section, Pill } from "../components/UI";

function Num({ label, value, onChange, prefix = "$", step = 100, hint }:
  { label: string; value: number; onChange: (v: number) => void; prefix?: string; step?: number; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-espresso/55">{hint}</span>}
      <div className="relative mt-1">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/50">{prefix}</span>}
        <input type="number" className={`input ${prefix ? "pl-7" : ""}`} value={value} min={0} step={step}
               onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} />
      </div>
    </label>
  );
}

export default function MyCafe() {
  const { hoods, analysis } = useData();
  const [params] = useSearchParams();
  const top = analysis.recommendation.data.picks[0];
  const [nta, setNta] = useState(params.get("nta") ?? top.nta);
  const h = hoods.find((x) => x.nta === nta)!;
  const shortName = h.name.split(/[-(]/)[0].trim();
  const [cafeName, setCafeName] = useState("");
  const name = cafeName || `${shortName} Coffee House`;
  const [style, setStyle] = useState<"cozy" | "vintage">("cozy");
  const design = analysis.design.styles[style];
  const kind = (h.area_type ?? "local") as "home" | "work" | "mixed" | "local";
  const layout = analysis.design.layouts[kind];
  const plan = analysis.plans[nta];

  // break-even (example numbers, the user replaces them with real quotes)
  const [ticket, setTicket] = useState(7.5);
  const [cogs, setCogs] = useState(30);
  const [rent, setRent] = useState(9000);
  const [staff, setStaff] = useState(16000);
  const [other, setOther] = useState(4000);
  const [days, setDays] = useState(plan?.hours.some((x) => x.includes("closed")) ? 22 : 30);
  const be = useMemo(() => {
    const fixed = rent + staff + other;
    const margin = ticket * (1 - cogs / 100);
    const perMonth = margin > 0 ? fixed / margin : Infinity;
    return { fixed, margin, perDay: Math.ceil(perMonth / Math.max(days, 1)) };
  }, [ticket, cogs, rent, staff, other, days]);
  const shareOfRiders = h.weekday_riders ? (be.perDay / h.weekday_riders) * 100 : null;

  return (
    <div className="fade-in pt-12 space-y-16">
      <Section eyebrow="My café plan" title={<>Your café in <span className="text-caramel-dark">{shortName}</span></>}
               intro="Choose a neighbourhood and a style. The Planner and Designer agents build the plan and the look; you fill in your own costs.">
        <div className="card p-5 grid sm:grid-cols-3 gap-4 items-end">
          <label className="block">
            <span className="text-sm font-medium">Neighbourhood</span>
            <select className="input mt-1" value={nta} onChange={(e) => setNta(e.target.value)}>
              <optgroup label="Agents' top picks">
                {analysis.recommendation.data.picks.map((p) => <option key={p.nta} value={p.nta}>{p.rank}. {p.name}</option>)}
              </optgroup>
              {["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"].map((b) => (
                <optgroup key={b} label={b}>
                  {hoods.filter((x) => x.residential && x.borough === b).sort((x, y) => x.name.localeCompare(y.name))
                    .map((x) => <option key={x.nta} value={x.nta}>{x.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Café name</span>
            <input className="input mt-1" placeholder={`${shortName} Coffee House`} value={cafeName} maxLength={26}
                   onChange={(e) => setCafeName(e.target.value)} />
          </label>
          <div>
            <span className="text-sm font-medium">Style</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["cozy", "vintage"] as const).map((s) => (
                <button key={s} onClick={() => setStyle(s)}
                        className={`rounded-xl px-3 py-2.5 text-sm border transition ${style === s ? "bg-espresso text-cream border-espresso" : "border-espresso/15 hover:bg-espresso/5"}`}>
                  {analysis.design.styles[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* the look */}
      <Section eyebrow="🎨 Café Designer" title="How your café could look">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
          <div className="card p-3 sm:p-4 overflow-hidden flex items-center">
            <Storefront key={style + name} name={name} style={style} palette={design.palette} className="w-full rounded-2xl fade-in" />
          </div>
          <div className="card p-6 space-y-5">
            <div>
              <div className="font-semibold flex items-center gap-2 mb-2"><Palette size={16} /> Colour palette</div>
              <div className="flex gap-2">
                {design.palette.map(([n, c]) => (
                  <div key={n} className="flex-1 text-center">
                    <div className="h-14 rounded-xl shadow-inner border border-espresso/10" style={{ background: c }} />
                    <div className="text-[11px] mt-1 leading-tight">{n}</div>
                  </div>
                ))}
              </div>
            </div>
            <div><div className="font-semibold mb-1">Materials</div><div className="flex flex-wrap gap-1.5">{design.materials.map((m) => <Pill key={m}>{m}</Pill>)}</div></div>
            <div><div className="font-semibold mb-1">Lighting</div><p className="text-sm text-espresso/75">💡 {design.lighting}</p></div>
            <div><div className="font-semibold mb-1">Music</div><p className="text-sm text-espresso/75">🎶 {design.music}</p></div>
            <div><div className="font-semibold mb-1">Little details</div><ul className="text-sm text-espresso/75 space-y-0.5">{design.details.map((d) => <li key={d}>✦ {d}</li>)}</ul></div>
          </div>
        </div>
        <div className="mt-6 grid lg:grid-cols-[1fr_1.2fr] gap-6">
          <div className="card p-6">
            <div className="eyebrow mb-1">Layout for a {areaType(h).label.toLowerCase()}</div>
            <h3 className="text-2xl font-semibold">{layout.label}: about {layout.seats} seats</h3>
            <ul className="mt-3 space-y-1.5 text-espresso/80">{layout.notes.map((n) => <li key={n}>🪑 {n}</li>)}</ul>
            <p className="mt-4 text-sm text-espresso/60">{areaType(h).text}</p>
          </div>
          <div className="card p-4"><FloorPlan kind={kind} palette={design.palette} className="w-full" /></div>
        </div>
      </Section>

      {/* the plan */}
      {plan && (
        <Section eyebrow="🧾 Business Planner" title="Your plan for this neighbourhood">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-6"><h3 className="text-lg font-semibold mb-2">🕖 Opening hours</h3><ul className="space-y-1.5 text-sm">{plan.hours.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div className="card p-6"><h3 className="text-lg font-semibold mb-2">💲 Price level: <span className="capitalize text-caramel-dark">{plan.price_tier}</span></h3><p className="text-sm">{plan.prices}</p></div>
            <div className="card p-6"><h3 className="text-lg font-semibold mb-2">✨ How to stand out</h3><ul className="space-y-1.5 text-sm">{plan.stand_out.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div className="card p-6"><h3 className="text-lg font-semibold mb-2">⚠️ Risks to watch</h3><ul className="space-y-1.5 text-sm">{plan.risks.map((x) => <li key={x}>{x}</li>)}</ul></div>
          </div>
          {plan.ideas && (
            <div className="mt-4 card p-6 bg-gradient-to-br from-caramel-light/30 to-cream-paper">
              <div className="eyebrow mb-1 flex items-center gap-1"><Sparkles size={14} /> Creative ideas from the AI planner</div>
              <p className="whitespace-pre-line leading-relaxed">{plan.ideas}</p>
            </div>
          )}
          <Link to={`/n/${nta}`} className="mt-4 inline-block text-sm font-medium text-caramel-dark hover:underline">See the full research on {h.name} →</Link>
        </Section>
      )}

      {/* break-even */}
      <Section eyebrow="Can I afford it?" title="Break-even calculator"
               intro="How many customers a day you need to cover your costs. The numbers below are only examples: replace them with real quotes for rent, staff and supplies.">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6">
          <div className="card p-6 grid sm:grid-cols-2 gap-4">
            <Num label="Average spend per customer" value={ticket} onChange={setTicket} step={0.25} hint="drink + sometimes a pastry" />
            <Num label="Cost of ingredients & cups" value={cogs} onChange={setCogs} prefix="" step={1} hint="% of each sale" />
            <Num label="Monthly rent" value={rent} onChange={setRent} hint="get real quotes: varies a lot by street" />
            <Num label="Monthly staff cost" value={staff} onChange={setStaff} hint="wages + payroll taxes" />
            <Num label="Other monthly costs" value={other} onChange={setOther} hint="utilities, insurance, repairs, card fees" />
            <Num label="Days open per month" value={days} onChange={setDays} prefix="" step={1} />
          </div>
          <div className="card p-8 bg-espresso text-cream flex flex-col justify-center">
            <Calculator className="text-caramel-light" />
            <div className="mt-3 text-cream/70">To break even you need about</div>
            <div className="font-display text-6xl font-semibold text-caramel-light">{Number.isFinite(be.perDay) ? fmt(be.perDay) : "–"}</div>
            <div className="text-xl">customers a day</div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-cream/10 p-3">Monthly costs<br /><b className="text-lg">{money(be.fixed)}</b></div>
              <div className="rounded-2xl bg-cream/10 p-3">You keep per customer<br /><b className="text-lg">${be.margin.toFixed(2)}</b></div>
            </div>
            {shareOfRiders != null && Number.isFinite(be.perDay) && (
              <p className="mt-5 text-cream/80 text-sm leading-relaxed">
                That's about <b className="text-cream">{shareOfRiders < 1 ? shareOfRiders.toFixed(1) : Math.round(shareOfRiders)}%</b> of the {fmt(h.weekday_riders)} people
                who enter {h.name}'s subway stations on a weekday, shared with {fmt(h.coffee_shops)} other coffee shops.
              </p>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
