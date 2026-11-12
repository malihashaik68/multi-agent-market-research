import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Cafe, Hood } from "../lib/data";

type Props = {
  map: any;
  hoods: Hood[];
  values: Record<string, number>;     // nta -> 0..100
  highlight?: string[];               // ntas to outline (top picks)
  selected?: string | null;
  onSelect?: (nta: string) => void;
  cafes?: Cafe[];                     // optional dots
  className?: string;
  focus?: string | null;              // zoom to one neighbourhood
};

// warm sequential scale: cream -> caramel -> espresso
const STOPS = ["#F3E7D6", "#E9C9A0", "#D9A26E", "#B5734A", "#7A4A30", "#3B2A20"];
export function colour(v: number | undefined) {
  if (v == null || Number.isNaN(v)) return "#E6DCCD";
  const t = Math.max(0, Math.min(0.9999, v / 100)) * (STOPS.length - 1);
  const i = Math.floor(t), f = t - i;
  const a = STOPS[i], b = STOPS[i + 1];
  const mix = (x: string, y: string) => Math.round(parseInt(x, 16) * (1 - f) + parseInt(y, 16) * f).toString(16).padStart(2, "0");
  return `#${mix(a.slice(1, 3), b.slice(1, 3))}${mix(a.slice(3, 5), b.slice(3, 5))}${mix(a.slice(5, 7), b.slice(5, 7))}`;
}

export default function NycMap({ map, hoods, values, highlight = [], selected, onSelect, cafes, className = "", focus }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const byNta = useMemo(() => Object.fromEntries(hoods.map((h) => [h.nta, h])), [hoods]);
  const W = 560, H = 560;
  const { path, projection } = useMemo(() => {
    const target = focus ? { ...map, features: map.features.filter((f: any) => f.properties.nta === focus) } : map;
    const projection = geoMercator().fitExtent([[12, 12], [W - 12, H - 12]], target);
    return { path: geoPath(projection), projection };
  }, [map, focus]);
  const hovered = hover ? byNta[hover] : null;

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Map of New York City neighbourhoods">
        <rect width={W} height={H} rx="24" fill="#DCE6E4" />
        {map.features.map((f: any) => {
          const nta = f.properties.nta;
          const h = byNta[nta];
          const res = h?.residential;
          const isSel = nta === selected || nta === focus;
          return (
            <path key={nta} d={path(f) ?? ""}
                  fill={res ? colour(values[nta]) : "#CFC6B6"}
                  stroke={isSel ? "#B5654A" : "#FBF7F1"} strokeWidth={isSel ? 2.5 : 0.6}
                  opacity={focus && nta !== focus ? 0.35 : 1}
                  className={res && onSelect ? "cursor-pointer transition-opacity hover:opacity-80" : ""}
                  onMouseEnter={() => res && setHover(nta)} onMouseLeave={() => setHover(null)}
                  onClick={() => res && onSelect?.(nta)} />
          );
        })}
        {highlight.map((nta, i) => {
          const f = map.features.find((x: any) => x.properties.nta === nta);
          if (!f) return null;
          const [x, y] = path.centroid(f);
          return (
            <g key={nta} transform={`translate(${x} ${y})`} className="pointer-events-none">
              <path d="M0 0 C-10 -12 -10 -24 0 -24 C10 -24 10 -12 0 0z" fill="#B5654A" stroke="#FBF7F1" strokeWidth="1.5" />
              <text y="-13" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FBF7F1" fontFamily="DM Sans">{i + 1}</text>
            </g>
          );
        })}
        {cafes?.map((c, i) => {
          const p = projection([c.lon, c.lat]);
          if (!p) return null;
          return <circle key={i} cx={p[0]} cy={p[1]} r={focus ? 4 : 1.6}
                         fill={c.chain ? "#5F6F52" : "#B5654A"} stroke="#FBF7F1" strokeWidth={focus ? 1 : 0.3} opacity=".9">
            <title>{c.name}{c.chain ? " (chain)" : ""}</title>
          </circle>;
        })}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 card px-4 py-3 text-sm max-w-[16rem] fade-in">
          <div className="font-display font-semibold leading-tight">{hovered.name}</div>
          <div className="text-espresso/60 text-xs">{hovered.borough}</div>
          <div className="mt-1">Score <b>{Math.round(values[hovered.nta] ?? 0)}</b> · {hovered.coffee_shops} coffee shops</div>
        </div>
      )}
    </div>
  );
}

export function MapLegend({ label = "Better match" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-espresso/70">
      <span>Lower</span>
      <div className="h-2 w-32 rounded-full" style={{ background: `linear-gradient(90deg, ${STOPS.join(",")})` }} />
      <span>{label}</span>
      <span className="ml-3 inline-block h-3 w-3 rounded-sm bg-[#CFC6B6]" /> Parks & non-residential
    </div>
  );
}
