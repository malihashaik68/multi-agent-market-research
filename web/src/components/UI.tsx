import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SCORE_INFO, SCORE_KEYS, type Hood, type ScoreKey, fmt } from "../lib/data";

export function Section({ eyebrow, title, intro, children, className = "" }:
  { eyebrow?: string; title: ReactNode; intro?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>
      {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
      {intro && <p className="mt-3 text-espresso/70 max-w-2xl text-lg leading-relaxed">{intro}</p>}
      {children && <div className="mt-8">{children}</div>}
    </section>
  );
}

export function Stat({ value, label, icon, tone = "caramel" }: { value: ReactNode; label: ReactNode; icon?: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    caramel: "bg-caramel-light/40", sage: "bg-sage-light/60", terracotta: "bg-terracotta-light/50", cream: "bg-cream-dark",
  };
  return (
    <div className="card p-5 flex items-start gap-4">
      {icon && <div className={`h-11 w-11 shrink-0 rounded-2xl grid place-items-center text-xl ${tones[tone]}`}>{icon}</div>}
      <div>
        <div className="font-display text-3xl font-semibold leading-none">{value}</div>
        <div className="mt-1.5 text-sm text-espresso/70 leading-snug">{label}</div>
      </div>
    </div>
  );
}

export function ScoreBars({ hood, compact = false }: { hood: Hood; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3.5"}>
      {SCORE_KEYS.map((k) => {
        const v = hood[`score_${k}`] ?? 0;
        return (
          <div key={k}>
            <div className="flex justify-between text-sm mb-1">
              <span>{SCORE_INFO[k].icon} {SCORE_INFO[k].label}</span>
              <span className="font-semibold tabular-nums">{Math.round(v)}</span>
            </div>
            <div className="h-2 rounded-full bg-espresso/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                   style={{ width: `${v}%`, background: v >= 70 ? "#5F6F52" : v >= 40 ? "#C68B59" : "#B5654A" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <div className={`relative grid place-items-center ${big ? "h-24 w-24" : "h-14 w-14"}`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#3B2A2015" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#C68B59" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 97.4} 97.4`} />
      </svg>
      <span className={`font-display font-semibold ${big ? "text-3xl" : "text-lg"}`}>{Math.round(score)}</span>
    </div>
  );
}

export function HourlyChart({ profile, height = 180 }: { profile: number[]; height?: number }) {
  const data = profile.map((v, h) => ({ hour: h, label: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="hr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C68B59" stopOpacity={0.7} />
            <stop offset="1" stopColor="#C68B59" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5A4335" }} interval={2} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#5A4335" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
        <Tooltip formatter={(v: number) => [fmt(v), "subway entries"]} labelFormatter={(l) => `Weekday ${l}`}
                 contentStyle={{ borderRadius: 12, border: "none", background: "#FBF7F1" }} />
        <Area type="monotone" dataKey="v" stroke="#A86E3E" strokeWidth={2} fill="url(#hr)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Weights({ weights, onChange }: { weights: Record<ScoreKey, number>; onChange: (w: Record<ScoreKey, number>) => void }) {
  return (
    <div className="space-y-4">
      {SCORE_KEYS.map((k) => (
        <label key={k} className="block">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{SCORE_INFO[k].icon} {SCORE_INFO[k].label}</span>
            <span className="text-espresso/60 tabular-nums">{Math.round(weights[k] * 100)}</span>
          </div>
          <div className="text-xs text-espresso/55 mb-1">{SCORE_INFO[k].help}</div>
          <input type="range" min={0} max={1} step={0.05} value={weights[k]}
                 onChange={(e) => onChange({ ...weights, [k]: Number(e.target.value) })} />
        </label>
      ))}
    </div>
  );
}

export function Pill({ children, tone = "cream" }: { children: ReactNode; tone?: "cream" | "sage" | "terracotta" | "caramel" }) {
  const t = { cream: "bg-cream-dark text-espresso", sage: "bg-sage-light text-forest", terracotta: "bg-terracotta-light/70 text-espresso",
              caramel: "bg-caramel-light/60 text-espresso" }[tone];
  return <span className={`chip ${t}`}>{children}</span>;
}
