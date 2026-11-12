import { useState } from "react";
import { CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { useData, fmt } from "../lib/data";
import { Section } from "../components/UI";

export default function Agents() {
  const { analysis } = useData();
  const { agents, trace, reports, meta } = analysis;
  const [showAll, setShowAll] = useState(false);
  const icon = (name: string) => agents.find((a) => a.name === name)?.icon ?? (name === "team" ? "👥" : "⚙️");
  const log = reports.checker.data.log as { agent: string; check: string; claimed: unknown; database: unknown; result: string }[];
  const shown = showAll ? trace : trace.slice(0, 18);

  return (
    <div className="fade-in pt-12 space-y-16">
      <Section eyebrow="The AI team" title="How the agents worked together"
               intro={<>Eight agents, one question. The specialists pull every number from the database with SQL; the
                 Lead Advisor coordinates and recommends; the Fact-Checker re-runs the queries before anything is published.
                 {meta.llm ? <> Written explanations use the <b>{meta.llm}</b> model (Groq).</> : <> This run used template text (no LLM key), so every sentence is built directly from verified numbers.</>}</>}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((a) => {
            const r = (reports as any)[a.key];
            return (
              <div key={a.key} className="card p-5">
                <div className="text-3xl">{a.icon}</div>
                <div className="mt-2 font-display text-lg font-semibold">{a.name}</div>
                <p className="mt-1 text-sm text-espresso/70">{a.role}</p>
                {r?.findings?.length > 0 && <div className="mt-3 text-xs text-sage-dark font-medium">{r.findings.length} findings</div>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section eyebrow="Conversation" title="What they said to each other" intro="The real message log from the last run.">
        <div className="card p-4 sm:p-6 space-y-3 max-h-[640px] overflow-y-auto">
          {shown.map((m, i) => {
            const lead = m.from === "Lead Advisor";
            return (
              <div key={i} className={`flex gap-3 ${lead ? "" : "flex-row-reverse text-right"}`}>
                <div className="h-10 w-10 shrink-0 rounded-full bg-cream-dark grid place-items-center text-xl">{icon(m.from)}</div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${lead ? "bg-caramel-light/40 rounded-tl-sm" : m.from === "Fact-Checker" ? "bg-sage-light/70 rounded-tr-sm" : "bg-cream-dark/80 rounded-tr-sm"}`}>
                  <div className="text-xs font-semibold text-espresso/60">{m.from} → {m.to}</div>
                  <div className="text-sm leading-relaxed mt-0.5">{m.content}</div>
                </div>
              </div>
            );
          })}
          {!showAll && trace.length > shown.length && (
            <button onClick={() => setShowAll(true)} className="btn-ghost mx-auto block text-sm">Show all {trace.length} messages</button>
          )}
        </div>
      </Section>

      <Section eyebrow="🛡️ Fact-Checker" title="Every number, checked" intro={reports.checker.summary}>
        <div className="card overflow-hidden">
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-dark/80 sticky top-0">
                <tr><th className="text-left p-3">Agent</th><th className="text-left p-3">Check</th><th className="text-right p-3">Claimed</th><th className="text-right p-3">Database</th><th className="p-3">Result</th></tr>
              </thead>
              <tbody>
                {log.map((r, i) => (
                  <tr key={i} className="border-t border-espresso/5">
                    <td className="p-3 whitespace-nowrap">{r.agent}</td>
                    <td className="p-3 font-mono text-xs">{r.check}</td>
                    <td className="p-3 text-right tabular-nums">{typeof r.claimed === "number" ? fmt(r.claimed, r.claimed < 1 ? 3 : 0) : String(r.claimed ?? "")}</td>
                    <td className="p-3 text-right tabular-nums">{typeof r.database === "number" ? fmt(r.database, r.database < 1 ? 3 : 0) : r.database == null ? "" : String(r.database)}</td>
                    <td className="p-3 text-center">{r.result === "verified" ?
                      <span className="chip bg-sage-light text-forest"><CheckCircle2 size={13} /> verified</span> :
                      <span className="chip bg-terracotta-light/70"><AlertTriangle size={13} /> {r.result}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section eyebrow="Method" title="Data and scoring">
        <div className="grid md:grid-cols-2 gap-4 text-sm leading-relaxed">
          <div className="card p-6">
            <div className="font-semibold flex items-center gap-2 mb-2"><Database size={16} /> Public data (no API keys)</div>
            <ul className="space-y-1.5 text-espresso/80">
              <li>☕ <b>NYC Health Dept. inspections</b>: every coffee shop, chain or independent, health grades, violations and pre-opening inspections (new cafés). As of {meta.as_of}.</li>
              <li>🚇 <b>MTA hourly subway ridership</b>: entries per station and hour, {meta.subway_period.join(" to ")}.</li>
              <li>🏪 <b>NYC storefront registry ({meta.storefront_year})</b>: storefronts and vacancies.</li>
              <li>💳 <b>NYC Neighborhood Financial Health (2020)</b>: median income by community district.</li>
              <li>🗺️ <b>2020 Neighborhood Tabulation Areas</b>: {meta.counts.neighbourhoods} residential neighbourhoods.</li>
            </ul>
          </div>
          <div className="card p-6">
            <div className="font-semibold mb-2">How a neighbourhood is scored</div>
            <p className="text-espresso/80">Each measure becomes a 0-100 score by ranking all neighbourhoods (100 = best in NYC).
              The overall match is a weighted average; you choose the weights on the Explore page.</p>
            <ul className="mt-2 space-y-1 text-espresso/80">
              <li>• <b>Low competition</b> = people per café and how few cafés there are.</li>
              <li>• <b>Foot traffic</b> = subway entries plus number of storefronts.</li>
              <li>• Limits: rent isn't public; income data is from 2020; closed cafés are removed from city records, so
                survival can't be measured.</li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}
