import { createContext, useContext, useEffect, useState } from "react";

export type ScoreKey =
  | "foot_traffic" | "low_competition" | "available_space" | "spending_power" | "growing_scene" | "independent_friendly";

export const SCORE_KEYS: ScoreKey[] = [
  "foot_traffic", "low_competition", "available_space", "spending_power", "growing_scene", "independent_friendly",
];

export const SCORE_INFO: Record<ScoreKey, { label: string; help: string; icon: string }> = {
  foot_traffic: { label: "Foot traffic", help: "Subway riders and how many shops are on the streets", icon: "🚶" },
  low_competition: { label: "Low competition", help: "Fewer cafés, and more people for each café", icon: "☕" },
  available_space: { label: "Empty storefronts", help: "Vacant shops where you could move in", icon: "🏪" },
  spending_power: { label: "Spending power", help: "Local incomes: who can pay for a good latte", icon: "💳" },
  growing_scene: { label: "Growing café scene", help: "New cafés opened recently: proven demand", icon: "🌱" },
  independent_friendly: { label: "Independent-friendly", help: "Independents do well here, not just chains", icon: "🏡" },
};

export type Hood = {
  nta: string; name: string; borough: string; residential: boolean;
  coffee_shops: number; chain_coffee: number; independent_coffee: number; tea_shops: number;
  bakeries_donuts_juice: number; new_coffee_shops: number; grade_a_share: number | null;
  stations: number; weekday_riders: number; weekend_riders: number; storefronts: number; vacant: number;
  median_income: number | null; independent_share: number | null; vacancy_rate: number | null;
  riders_per_cafe: number; area_type: "home" | "work" | "mixed" | null; hourly_profile: number[] | null;
} & { [K in ScoreKey as `score_${K}`]: number | null };

export type Cafe = {
  name: string; brand_name: string; segment: string; chain: boolean; grade: string | null; lat: number; lon: number;
  nta: string; opened_recently: boolean; address: string;
};
export type Station = { station_complex: string; lat: number; lon: number; weekday: number; weekend: number; nta: string };

export type Finding = { id: string; text: string; value: unknown; sql: string | null };
export type Report = { agent: string; role: string; summary: string; findings: Finding[]; data: any; written_by: string };
export type Pick = {
  rank: number; nta: string; name: string; borough: string; overall: number; why: string; written_by: string;
  strengths: string[]; watch_out: string[]; facts: string[]; scores: Record<ScoreKey, number>;
};
export type Plan = {
  nta: string; price_tier: string; prices: string; hours: string[]; stand_out: string[]; risks: string[];
  area_type: string; ideas?: string;
};
export type Analysis = {
  meta: { as_of: string; generated: string; llm: string | null; recent_months: number; subway_period: string[];
    storefront_year: string; counts: { cafes: number; all_places: number; neighbourhoods: number; stations: number } };
  weights: Record<ScoreKey, number>;
  agents: { key: string; name: string; icon: string; role: string }[];
  reports: Record<"competitor" | "trend" | "location" | "operations" | "checker", Report>;
  recommendation: Omit<Report, "data"> & { data: { picks: Pick[]; by_borough: { borough: string; nta: string; name: string; overall: number; rank: number }[]; rent_note: string } };
  plans: Record<string, Plan>;
  design: { styles: Record<string, DesignStyle>; layouts: Record<string, Layout> };
  trace: { from: string; to: string; content: string }[];
};
export type DesignStyle = { label: string; palette: [string, string][]; materials: string[]; lighting: string; music: string; details: string[] };
export type Layout = { label: string; seats: number; notes: string[] };

export type Data = { hoods: Hood[]; cafes: Cafe[]; stations: Station[]; map: any; analysis: Analysis };

export const DataContext = createContext<Data | null>(null);
export const useData = () => {
  const d = useContext(DataContext);
  if (!d) throw new Error("data not loaded");
  return d;
};

export function useLoadData() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const get = (f: string) => fetch(`${import.meta.env.BASE_URL}data/${f}`).then((r) => {
      if (!r.ok) throw new Error(`${f}: ${r.status}`);
      return r.json();
    });
    Promise.all(["neighbourhoods.json", "cafes.json", "stations.json", "map.json", "analysis.json"].map(get))
      .then(([hoods, cafes, stations, map, analysis]) => setData({ hoods, cafes, stations, map, analysis }))
      .catch((e) => setError(String(e)));
  }, []);
  return { data, error };
}

// ------------------------------------------------------------- scoring
export function overall(h: Hood, weights: Record<ScoreKey, number>): number {
  let sum = 0, total = 0;
  for (const k of SCORE_KEYS) {
    const w = weights[k] ?? 0;
    sum += (h[`score_${k}`] ?? 0) * w;
    total += w;
  }
  return total ? Math.round((sum / total) * 10) / 10 : 0;
}

export function rankHoods(hoods: Hood[], weights: Record<ScoreKey, number>, borough = "All") {
  return hoods
    .filter((h) => h.residential && (borough === "All" || h.borough === borough))
    .map((h) => ({ hood: h, score: overall(h, weights) }))
    .sort((a, b) => b.score - a.score);
}

// ------------------------------------------------------------ formatting
export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? "–" : n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const pct = (n: number | null | undefined) => (n == null ? "–" : `${Math.round(n * 100)}%`);
export const money = (n: number | null | undefined) => (n == null ? "–" : `$${fmt(n)}`);

export const AREA_TYPE: Record<string, { label: string; text: string }> = {
  home: { label: "Home area", text: "People head to work in the morning: a strong morning coffee crowd." },
  work: { label: "Work area", text: "Workers arrive in the morning and leave 4-8 pm: busy weekdays, quieter weekends." },
  mixed: { label: "Mixed area", text: "Homes and offices: steady customers through the day." },
  local: { label: "Local area", text: "No subway station: customers are mostly neighbours who walk or drive." },
};
export const areaType = (h: Hood) => AREA_TYPE[h.area_type ?? "local"];

export const BOROUGHS = ["All", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
