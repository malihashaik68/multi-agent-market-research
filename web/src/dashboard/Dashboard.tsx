import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, KeyRound, Lock, Minus, PartyPopper, Plus, Shield, Trash2, Upload } from "lucide-react";
import { DAY_NAMES, type Entry, advice, alerts, forecast, movingAverage, periodCompare, sampleData, sorted, status, weekdayPattern } from "./analytics";
import { EMPTY, type Vault, create, destroy, download, fromCSV, hasVault, open, save, toCSV } from "./vault";
import { CupLogo } from "../components/Illustrations";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ------------------------------------------------------------------ gate
function Gate({ onOpen, onDemo }: { onOpen: (pin: string, v: Vault) => void; onDemo: () => void }) {
  const exists = hasVault();
  const [pin, setPin] = useState(""), [pin2, setPin2] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (!/^\d{4,8}$/.test(pin)) return setErr("Use 4 to 8 digits.");
    setBusy(true);
    if (exists) {
      const v = await open(pin);
      setBusy(false);
      return v ? onOpen(pin, v) : setErr("That PIN doesn't match.");
    }
    if (pin !== pin2) { setBusy(false); return setErr("The two PINs don't match."); }
    await create(pin);
    setBusy(false);
    onOpen(pin, EMPTY);
  };
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 grid md:grid-cols-2 gap-10 items-center fade-in">
      <div>
        <div className="eyebrow !text-forest mb-3">Part 2 · Private</div>
        <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">Your café's daily dashboard</h1>
        <p className="mt-4 text-lg text-espresso/75 leading-relaxed">Log customers and sales each day. See if you're growing or slipping,
          spot unusual days, and get a forecast and advice.</p>
        <ul className="mt-6 space-y-3 text-espresso/80">
          <li className="flex gap-3"><Shield className="text-sage-dark shrink-0" /> <span><b>Stays on your device.</b> Your numbers are saved only in this browser. Nothing is sent to any server, not even ours.</span></li>
          <li className="flex gap-3"><KeyRound className="text-sage-dark shrink-0" /> <span><b>Encrypted with your PIN.</b> Without the PIN the saved data is unreadable.</span></li>
          <li className="flex gap-3"><Download className="text-sage-dark shrink-0" /> <span><b>Your backup, your file.</b> Download a backup any time to keep it safe or move it to another device.</span></li>
        </ul>
      </div>
      <div className="card p-8 bg-gradient-to-br from-sage-light/50 to-cream-paper">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-12 w-12 rounded-2xl bg-forest text-cream grid place-items-center"><Lock /></div>
          <div>
            <div className="font-display text-xl font-semibold">{exists ? "Welcome back" : "Create your PIN"}</div>
            <div className="text-sm text-espresso/60">{exists ? "Enter your PIN to unlock" : "4-8 digits. Don't forget it: it can't be reset."}</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" type="password" autoComplete="off"
                 placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} aria-label="PIN" />
          {!exists && <input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" type="password" autoComplete="off"
                             placeholder="repeat" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))} aria-label="Repeat PIN" />}
          {err && <div className="text-sm text-terracotta">{err}</div>}
          <button className="btn w-full justify-center bg-forest text-cream hover:bg-forest/90" disabled={busy}>
            {busy ? "Unlocking…" : exists ? "Unlock" : "Create my dashboard"}
          </button>
        </form>
        <div className="divider my-6 text-xs">or</div>
        <button onClick={onDemo} className="btn-ghost w-full justify-center">Try it with sample data</button>
        <p className="mt-2 text-xs text-center text-espresso/55">Sample data is fictional and is never saved.</p>
        {exists && (
          <button className="mt-4 text-xs text-espresso/50 hover:text-terracotta w-full" onClick={() => {
            if (confirm("Forgot your PIN? This deletes the saved dashboard on this device. Continue?")) { destroy(); location.reload(); }
          }}>Forgot PIN? Start over</button>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- dashboard
function Delta({ change }: { change: number | null | undefined }) {
  if (change == null) return <span className="text-espresso/50 text-sm">–</span>;
  const up = change > 0.005, down = change < -0.005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return <span className={`inline-flex items-center text-sm font-semibold ${up ? "text-sage-dark" : down ? "text-terracotta" : "text-espresso/60"}`}>
    <Icon size={16} />{Math.abs(Math.round(change * 100))}%</span>;
}

export default function Dashboard() {
  const [pin, setPin] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [vault, setVault] = useState<Vault>(EMPTY);
  const unlocked = pin != null || demo;

  // auto-lock after 15 minutes without activity
  useEffect(() => {
    if (!pin) return;
    let t = setTimeout(() => setPin(null), 15 * 60 * 1000);
    const reset = () => { clearTimeout(t); t = setTimeout(() => setPin(null), 15 * 60 * 1000); };
    window.addEventListener("pointerdown", reset); window.addEventListener("keydown", reset);
    return () => { clearTimeout(t); window.removeEventListener("pointerdown", reset); window.removeEventListener("keydown", reset); };
  }, [pin]);

  const update = async (v: Vault) => {
    setVault(v);
    if (pin && !demo) await save(pin, v);
  };

  if (!unlocked) return <Gate onOpen={(p, v) => { setPin(p); setVault(v); }}
                              onDemo={() => { setDemo(true); setVault({ entries: sampleData(), settings: { cafeName: "Sample Café (fictional)", monthlyCosts: 27000, daysOpen: 30 } }); }} />;
  return <Board vault={vault} demo={demo} onChange={update} onLock={() => { setPin(null); setDemo(false); setVault(EMPTY); }} />;
}

function Board({ vault, demo, onChange, onLock }: { vault: Vault; demo: boolean; onChange: (v: Vault) => void; onLock: () => void }) {
  const es = useMemo(() => sorted(vault.entries), [vault.entries]);
  const { settings } = vault;
  const breakEven = settings.monthlyCosts > 0 && settings.daysOpen > 0 ? settings.monthlyCosts / settings.daysOpen : 0;
  const st = status(es);
  const s7 = periodCompare(es, "sales", 7), c7 = periodCompare(es, "customers", 7);
  const s28 = periodCompare(es, "sales", 28), c28 = periodCompare(es, "customers", 28);
  const ticket = s28 && c28 && c28.current ? s28.current / c28.current : null;
  const fc = useMemo(() => forecast(es, 30), [es]);
  const fcTotal = fc.reduce((a, f) => a + f.forecast, 0);
  const al = useMemo(() => alerts(es, breakEven), [es, breakEven]);
  const tips = useMemo(() => advice(es, breakEven), [es, breakEven]);
  const wk = weekdayPattern(es.slice(-56), "sales");
  const chart = useMemo(() => {
    const ma = movingAverage(es.slice(-90), "sales");
    return [...ma.map((m) => ({ date: m.date, sales: m.value, avg: m.avg, forecast: null as number | null })),
            ...fc.map((f) => ({ date: f.date, sales: null, avg: null, forecast: f.forecast }))];
  }, [es, fc]);
  const tone = { Growing: "bg-sage-light text-forest", Steady: "bg-caramel-light/60 text-espresso", Declining: "bg-terracotta-light text-espresso", "Getting started": "bg-cream-dark text-espresso" }[st.label];

  // add / edit form
  const [form, setForm] = useState({ date: today(), customers: "", sales: "", expenses: "", note: "" });
  const [all, setAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: Entry = { date: form.date, customers: Number(form.customers), sales: Number(form.sales),
                           expenses: form.expenses ? Number(form.expenses) : null, note: form.note || undefined };
    if (!entry.date || !Number.isFinite(entry.customers) || !Number.isFinite(entry.sales)) return;
    onChange({ ...vault, entries: [...vault.entries.filter((x) => x.date !== entry.date), entry] });
    setForm({ date: today(), customers: "", sales: "", expenses: "", note: "" });
  };
  const remove = (date: string) => onChange({ ...vault, entries: vault.entries.filter((x) => x.date !== date) });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-6 fade-in">
      {demo && (
        <div className="rounded-2xl bg-caramel-light/50 px-5 py-3 text-sm flex flex-wrap gap-2 items-center justify-between">
          <span>👀 You're viewing <b>fictional sample data</b>. Nothing is saved. Create a PIN to start your own private dashboard.</span>
          <button onClick={onLock} className="font-semibold underline">Exit demo</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <CupLogo className="h-12 w-12" />
          <div>
            <div className="eyebrow !text-forest">Private dashboard</div>
            <h1 className="text-3xl font-semibold">{settings.cafeName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`chip text-sm !px-4 !py-1.5 ${tone}`}>{st.label === "Growing" ? "📈" : st.label === "Declining" ? "📉" : "➖"} {st.label}</span>
          <button onClick={onLock} className="btn-ghost !py-2 text-sm"><Lock size={15} /> {demo ? "Exit" : "Lock"}</button>
        </div>
      </div>
      <p className="text-espresso/70 -mt-2">{st.detail}</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5"><div className="text-sm text-espresso/60">Sales, last 7 days</div><div className="font-display text-3xl font-semibold">${fmt(s7?.current ?? 0)}</div><Delta change={s7?.change} /> <span className="text-xs text-espresso/50">vs week before</span></div>
        <div className="card p-5"><div className="text-sm text-espresso/60">Customers, last 7 days</div><div className="font-display text-3xl font-semibold">{fmt(c7?.current ?? 0)}</div><Delta change={c7?.change} /> <span className="text-xs text-espresso/50">vs week before</span></div>
        <div className="card p-5"><div className="text-sm text-espresso/60">Average spend</div><div className="font-display text-3xl font-semibold">{ticket ? `$${ticket.toFixed(2)}` : "–"}</div><span className="text-xs text-espresso/50">per customer, 4 weeks</span></div>
        <div className="card p-5"><div className="text-sm text-espresso/60">Next 30 days (forecast)</div><div className="font-display text-3xl font-semibold">{fc.length ? `$${fmt(fcTotal)}` : "–"}</div><span className="text-xs text-espresso/50">if the trend continues</span></div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="card p-5">
          <h3 className="text-lg font-semibold mb-2">Daily sales</h3>
          {es.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chart} margin={{ left: -6, right: 8 }}>
                <CartesianGrid stroke="#3B2A2010" vertical={false} />
                <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11 }} minTickGap={24} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${fmt(v)}`} />
                <Tooltip labelFormatter={(d) => short(String(d))} formatter={(v: number, n: string) => [`$${fmt(v)}`, n]} contentStyle={{ borderRadius: 12, border: "none", background: "#FBF7F1" }} />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill="#E2B98F" radius={[3, 3, 0, 0]} />
                <Line dataKey="avg" name="7-day average" stroke="#3B2A20" strokeWidth={2} dot={false} connectNulls />
                <Line dataKey="forecast" name="Forecast" stroke="#5F6F52" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                {breakEven > 0 && <ReferenceLine y={breakEven} stroke="#B5654A" strokeDasharray="3 3" label={{ value: "break-even", fill: "#B5654A", fontSize: 11, position: "insideTopLeft" }} />}
              </ComposedChart>
            </ResponsiveContainer>
          ) : <div className="py-20 text-center text-espresso/60">No days logged yet. Add your first day →</div>}
        </div>
        <form onSubmit={add} className="card p-5 space-y-3 h-fit">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Plus size={18} /> Log a day</h3>
          <label className="block text-sm">Date<input type="date" className="input mt-1" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Customers<input type="number" min={0} className="input mt-1" value={form.customers} onChange={(e) => setForm({ ...form, customers: e.target.value })} required /></label>
            <label className="block text-sm">Sales ($)<input type="number" min={0} step="0.01" className="input mt-1" value={form.sales} onChange={(e) => setForm({ ...form, sales: e.target.value })} required /></label>
          </div>
          <label className="block text-sm">Expenses ($, optional)<input type="number" min={0} step="0.01" className="input mt-1" value={form.expenses} onChange={(e) => setForm({ ...form, expenses: e.target.value })} /></label>
          <label className="block text-sm">Note (optional)<input className="input mt-1" placeholder="rain, holiday, new pastry…" maxLength={60} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <button className="btn w-full justify-center bg-forest text-cream hover:bg-forest/90">Save day</button>
          <p className="text-xs text-espresso/50">Saving the same date again replaces it.</p>
        </form>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <h3 className="text-lg font-semibold mb-2">Your week</h3>
          <p className="text-xs text-espresso/55 mb-2">Average sales by weekday, last 8 weeks</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: DAY_NAMES[d], sales: Math.round(wk[d]) }))} margin={{ left: -14 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `$${fmt(v)}`} contentStyle={{ borderRadius: 12, border: "none", background: "#FBF7F1" }} />
              <Bar dataKey="sales" fill="#8A9A7B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h3 className="text-lg font-semibold mb-3">Alerts</h3>
          {al.length ? <ul className="space-y-2.5 max-h-60 overflow-y-auto pr-1">{al.slice(0, 8).map((a, i) => (
            <li key={i} className={`rounded-xl px-3 py-2 text-sm ${a.kind === "high" ? "bg-sage-light/60" : "bg-terracotta-light/40"}`}>
              <div className="text-xs text-espresso/55 flex items-center gap-1">{a.kind === "high" ? <PartyPopper size={12} /> : <AlertTriangle size={12} />} {short(a.date)}</div>{a.text}
            </li>))}</ul> : <p className="text-sm text-espresso/60">Nothing unusual. 👍</p>}
        </div>
        <div className="card p-5">
          <h3 className="text-lg font-semibold mb-3">Advice</h3>
          <ul className="space-y-2.5 text-sm">{tips.map((t) => <li key={t} className="flex gap-2"><span>💡</span><span>{t}</span></li>)}</ul>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3"><h3 className="text-lg font-semibold">Logged days ({es.length})</h3>
            {es.length > 10 && <button className="text-sm underline" onClick={() => setAll(!all)}>{all ? "Show fewer" : "Show all"}</button>}</div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-dark/70 sticky top-0"><tr><th className="p-2.5 text-left">Date</th><th className="p-2.5 text-right">Customers</th><th className="p-2.5 text-right">Sales</th><th className="p-2.5 text-right">Spend/cust.</th><th className="p-2.5 text-left">Note</th><th /></tr></thead>
              <tbody>{[...es].reverse().slice(0, all ? undefined : 10).map((e) => (
                <tr key={e.date} className="border-t border-espresso/5">
                  <td className="p-2.5">{DAY_NAMES[new Date(`${e.date}T12:00:00`).getDay()]} {short(e.date)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(e.customers)}</td>
                  <td className="p-2.5 text-right tabular-nums">${fmt(e.sales)}</td>
                  <td className="p-2.5 text-right tabular-nums">{e.customers ? `$${(e.sales / e.customers).toFixed(2)}` : "–"}</td>
                  <td className="p-2.5 text-espresso/60">{e.note}</td>
                  <td className="p-2.5 text-right"><button aria-label="Delete" onClick={() => remove(e.date)} className="text-espresso/40 hover:text-terracotta"><Trash2 size={15} /></button></td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
        <div className="card p-5 space-y-3 h-fit">
          <h3 className="text-lg font-semibold">Settings & backup</h3>
          <label className="block text-sm">Café name<input className="input mt-1" value={settings.cafeName} maxLength={40} onChange={(e) => onChange({ ...vault, settings: { ...settings, cafeName: e.target.value } })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Monthly costs ($)<input type="number" min={0} className="input mt-1" value={settings.monthlyCosts || ""} onChange={(e) => onChange({ ...vault, settings: { ...settings, monthlyCosts: Number(e.target.value) } })} /></label>
            <label className="block text-sm">Days open / month<input type="number" min={1} max={31} className="input mt-1" value={settings.daysOpen} onChange={(e) => onChange({ ...vault, settings: { ...settings, daysOpen: Number(e.target.value) } })} /></label>
          </div>
          {breakEven > 0 && <p className="text-sm text-espresso/70">Break-even: about <b>${fmt(breakEven)}</b> in sales a day.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn-ghost !py-2 text-sm" onClick={() => download(`cafe-backup-${today()}.csv`, toCSV(es))}><Download size={15} /> Backup (CSV)</button>
            <button className="btn-ghost !py-2 text-sm" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { const rows = fromCSV(await f.text()); const map = new Map(vault.entries.map((x) => [x.date, x])); rows.forEach((r) => map.set(r.date, r));
                    onChange({ ...vault, entries: [...map.values()] }); alert(`Imported ${rows.length} days.`); }
              catch (err) { alert(String(err)); } e.target.value = ""; }} />
          </div>
          {!demo && <button className="text-xs text-espresso/50 hover:text-terracotta" onClick={() => {
            if (confirm("Delete ALL your dashboard data on this device? Download a backup first if you need it.")) { destroy(); location.reload(); } }}>Delete all data on this device</button>}
          <p className="text-xs text-espresso/50 flex gap-1.5"><Shield size={13} className="shrink-0 mt-0.5" /> Encrypted with your PIN and stored only in this browser. Locks after 15 minutes idle.</p>
        </div>
      </div>
    </div>
  );
}
