import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Lock, Menu, X } from "lucide-react";
import { DataContext, useLoadData } from "./lib/data";
import { CupLogo } from "./components/Illustrations";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Neighbourhood from "./pages/Neighbourhood";
import Compare from "./pages/Compare";
import Insights from "./pages/Insights";
import MyCafe from "./pages/MyCafe";
import Agents from "./pages/Agents";
import Dashboard from "./dashboard/Dashboard";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Where to open" },
  { to: "/insights", label: "What works" },
  { to: "/my-cafe", label: "My café plan" },
  { to: "/agents", label: "The AI team" },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-full text-sm font-medium transition ${isActive ? "bg-espresso text-cream" : "hover:bg-espresso/5"}`;
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-cream/80 border-b border-espresso/5">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-4">
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <CupLogo className="h-9 w-9" />
          <span className="font-display text-xl font-semibold tracking-tight">Brew <span className="text-caramel">&</span> Borough</span>
        </NavLink>
        <nav className="hidden md:flex items-center gap-1 ml-auto">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} end className={link}>{l.label}</NavLink>)}
          <NavLink to="/dashboard" className={({ isActive }) =>
            `ml-2 btn !py-2 !px-4 text-sm ${isActive ? "bg-forest text-cream" : "bg-sage-light/70 hover:bg-sage-light text-forest"}`}>
            <Lock size={14} /> My dashboard
          </NavLink>
        </nav>
        <button className="md:hidden ml-auto p-2" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="md:hidden px-4 pb-4 flex flex-col gap-1">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} end className={link}>{l.label}</NavLink>)}
          <NavLink to="/dashboard" className={link}>🔒 My dashboard</NavLink>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-espresso/10 bg-espresso text-cream/80">
      <div className="mx-auto max-w-6xl px-6 py-10 grid gap-6 md:grid-cols-3 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CupLogo className="h-8 w-8" light />
            <span className="font-display text-lg text-cream">Brew & Borough</span>
          </div>
          <p>A team of AI agents that studies New York City to help a first-time owner open a coffee shop.</p>
        </div>
        <div>
          <div className="font-semibold text-cream mb-2">Public data used</div>
          <ul className="space-y-1">
            <li>NYC Health Dept. restaurant inspections</li>
            <li>MTA subway hourly ridership</li>
            <li>NYC storefront registry</li>
            <li>NYC Neighborhood Financial Health</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-cream mb-2">Good to know</div>
          <p>Research and ideas, not financial advice. Rent prices aren't public: always check listings and talk to a
            small-business adviser (NYC Small Business Services is free).</p>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const { data, error } = useLoadData();
  const loc = useLocation();
  const dashboard = loc.pathname.startsWith("/dashboard");
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1">
        {dashboard ? <Dashboard /> : error ? (
          <div className="mx-auto max-w-xl p-10 text-center">Couldn't load the research data ({error}).</div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 text-espresso/70">
            <CupLogo className="h-16 w-16" steam />
            <p className="font-display text-lg italic">Brewing the research…</p>
          </div>
        ) : (
          <DataContext.Provider value={data}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/n/:nta" element={<Neighbourhood />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/my-cafe" element={<MyCafe />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </DataContext.Provider>
        )}
      </main>
      <Footer />
    </div>
  );
}
