import { Link } from "react-router-dom";
import { ArrowRight, Lock, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { useData, fmt } from "../lib/data";
import { HeroScene } from "../components/Illustrations";
import { Section, Stat, ScoreBadge, Pill } from "../components/UI";

export default function Home() {
  const { analysis } = useData();
  const { meta, recommendation, agents } = analysis;
  const picks = recommendation.data.picks;
  const top = picks[0];
  const newShops = analysis.reports.trend.findings.find((f) => f.id === "new_total")?.value as number;

  return (
    <div className="fade-in">
      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="eyebrow mb-4">A coffee-shop dream, backed by data</div>
          <h1 className="text-5xl sm:text-6xl font-semibold leading-[1.05] tracking-tight">
            Find the perfect <em className="text-caramel-dark not-italic font-display italic">corner</em> for your café.
          </h1>
          <p className="mt-6 text-lg text-espresso/75 leading-relaxed max-w-xl">
            A team of AI agents studied every coffee shop, subway station and storefront in New York City to answer
            one question: <b>where should a first-time owner open a café, and why?</b>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/explore" className="btn-primary">Find my spot <ArrowRight size={18} /></Link>
            <Link to="/my-cafe" className="btn-ghost">Design my café</Link>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-espresso/60">
            <ShieldCheck size={16} className="text-sage-dark" /> Every number checked by a fact-checker agent · data as of {meta.as_of}
          </div>
        </div>
        <div className="relative">
          <HeroScene className="w-full drop-shadow-xl" />
          <div className="absolute -bottom-6 -left-2 sm:left-6 card px-5 py-4 flex items-center gap-4 fade-in" style={{ animationDelay: ".3s" }}>
            <ScoreBadge score={top.overall} />
            <div>
              <div className="text-xs text-espresso/60">The agents' top pick</div>
              <div className="font-display text-lg font-semibold leading-tight">{top.name}</div>
              <div className="text-sm text-espresso/60">{top.borough}</div>
            </div>
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon="☕" value={fmt(meta.counts.cafes)} label="coffee shops mapped" />
        <Stat icon="🌱" value={fmt(newShops)} label={`opened in the last ${meta.recent_months} months`} tone="sage" />
        <Stat icon="🚇" value={fmt(meta.counts.stations)} label="subway stations' hourly traffic" tone="cream" />
        <Stat icon="🏘️" value={meta.counts.neighbourhoods} label="neighbourhoods compared" tone="terracotta" />
      </section>

      {/* top picks */}
      <Section className="mt-24" eyebrow="The recommendation" title="Where the agents would open first"
               intro="Ranked on foot traffic, competition, empty storefronts, spending power, new-café momentum and how well independents do. Change the priorities on the Explore page.">
        <div className="grid md:grid-cols-5 gap-4">
          {picks.map((p) => (
            <Link key={p.nta} to={`/n/${p.nta}`} className="card p-5 hover:shadow-lift hover:-translate-y-1 transition group">
              <div className="flex items-center justify-between">
                <span className="font-display text-4xl text-caramel/70">{p.rank}</span>
                <ScoreBadge score={p.overall} />
              </div>
              <div className="mt-3 font-display text-lg font-semibold leading-tight group-hover:text-caramel-dark">{p.name}</div>
              <div className="text-sm text-espresso/60">{p.borough}</div>
            </Link>
          ))}
        </div>
        <div className="mt-6 card p-5">
          <div className="font-semibold mb-3 flex items-center gap-2"><MapPin size={16} /> Best in each borough</div>
          <div className="flex flex-wrap gap-2">
            {recommendation.data.by_borough.map((b) => (
              <Link key={b.borough} to={`/n/${b.nta}`}><Pill tone="caramel">{b.borough}: <b>{b.name}</b> ({Math.round(b.overall)})</Pill></Link>
            ))}
          </div>
          <p className="mt-3 text-sm text-espresso/60">{recommendation.data.rent_note}</p>
        </div>
      </Section>

      {/* how it works */}
      <Section className="mt-24" eyebrow="How it works" title="A small consulting team, made of AI agents"
               intro="Each agent has one job. The Lead Advisor coordinates them, and the Fact-Checker re-checks every number against the database before you see it.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((a) => (
            <div key={a.key} className="card p-5">
              <div className="text-3xl">{a.icon}</div>
              <div className="mt-2 font-display text-lg font-semibold">{a.name}</div>
              <p className="mt-1 text-sm text-espresso/70 leading-relaxed">{a.role}</p>
            </div>
          ))}
        </div>
        <Link to="/agents" className="mt-6 inline-flex items-center gap-2 font-medium text-caramel-dark hover:underline">
          Watch how they worked together <ArrowRight size={16} />
        </Link>
      </Section>

      {/* two parts */}
      <Section className="mt-24" eyebrow="Two parts" title="Plan it. Then run it.">
        <div className="grid md:grid-cols-2 gap-5">
          <Link to="/my-cafe" className="card p-8 hover:shadow-lift transition bg-gradient-to-br from-caramel-light/40 to-cream-paper">
            <Sparkles className="text-caramel-dark" />
            <h3 className="mt-3 text-2xl font-semibold">Plan my café</h3>
            <p className="mt-2 text-espresso/70">Pick a neighbourhood and a style. Get opening hours, a price level, ways to stand
              out, risks to watch, a break-even calculator, and a picture of how your café could look.</p>
          </Link>
          <Link to="/dashboard" className="card p-8 hover:shadow-lift transition bg-gradient-to-br from-sage-light/60 to-cream-paper">
            <Lock className="text-forest" />
            <h3 className="mt-3 text-2xl font-semibold">My private dashboard</h3>
            <p className="mt-2 text-espresso/70">Once you're open, log customers and sales each day. See if you're growing, get
              alerts and a forecast. Your numbers stay on your device, never on a server.</p>
          </Link>
        </div>
      </Section>
    </div>
  );
}
