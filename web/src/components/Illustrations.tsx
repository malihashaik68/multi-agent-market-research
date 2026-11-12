// Hand-made SVG illustrations (no stock photos): logo, café storefront and floor plan.

export function CupLogo({ className = "", light = false, steam = false }: { className?: string; light?: boolean; steam?: boolean }) {
  const cup = light ? "#F7F0E6" : "#3B2A20";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <g stroke="#C68B59" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path className={steam ? "steam" : ""} d="M24 18c-3-4 3-6 0-10" />
        <path className={steam ? "steam" : ""} style={{ animationDelay: ".6s" }} d="M32 18c-3-4 3-6 0-10" />
        <path className={steam ? "steam" : ""} style={{ animationDelay: "1.2s" }} d="M40 18c-3-4 3-6 0-10" />
      </g>
      <path d="M12 24h38v10c0 11-8.5 20-19 20S12 45 12 34V24z" fill={cup} />
      <path d="M50 28h3a6 6 0 0 1 0 12h-4" stroke={cup} strokeWidth="4" fill="none" />
      <path d="M8 57h46" stroke="#C68B59" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 34c4 4 14 4 18 0" stroke="#C68B59" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

type StoreProps = { name: string; style: "cozy" | "vintage"; palette: [string, string][]; tagline?: string; className?: string };

export function Storefront({ name, style, palette, tagline = "Coffee · Pastries · Good company", className = "" }: StoreProps) {
  const [c1, c2, c3, c4, c5] = palette.map((p) => p[1]);
  const vintage = style === "vintage";
  const facade = vintage ? c1 : c5;
  const sign = vintage ? c1 : c1;
  const letters = vintage ? c2 : c3;
  const stripes = vintage ? [c1, c3] : [c2, c3];
  const id = `sf-${style}`;
  return (
    <svg viewBox="0 0 640 440" className={className} role="img" aria-label={`Illustration of ${name}, a ${style} café`}>
      <defs>
        <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE3A8" />
          <stop offset="1" stopColor="#F2B76B" />
        </linearGradient>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3E6D3" />
          <stop offset="1" stopColor="#EBD9C2" />
        </linearGradient>
        <pattern id={`${id}-brick`} width="36" height="18" patternUnits="userSpaceOnUse">
          <rect width="36" height="18" fill={vintage ? "#8E4B3A" : "#C9A889"} />
          <path d="M0 0h36M0 9h36M18 0v9M0 9v9M36 9v9" stroke={vintage ? "#6E3528" : "#B8946F"} strokeWidth="1.2" />
        </pattern>
        <pattern id={`${id}-tile`} width="16" height="8" patternUnits="userSpaceOnUse">
          <rect width="16" height="8" fill={c1} />
          <rect x="0.6" y="0.6" width="14.8" height="6.8" rx="1.5" fill={c1} stroke="#ffffff22" />
        </pattern>
      </defs>
      <rect width="640" height="440" fill={`url(#${id}-sky)`} />
      {/* building */}
      <rect x="40" y="30" width="560" height="340" fill={`url(#${id}-brick)`} />
      <rect x="40" y="30" width="560" height="22" fill={vintage ? c2 : c1} />
      <rect x="70" y="70" width="500" height="64" rx="6" fill={sign} stroke={vintage ? c2 : c2} strokeWidth="4" />
      <text x="320" y="113" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight="600"
            fontSize={Math.min(34, Math.floor(820 / Math.max(name.length, 1)))} fill={letters}
            letterSpacing={name.length > 20 ? 0.5 : 2}>{name}</text>
      {/* string lights (cozy) */}
      {!vintage && (
        <g>
          <path d="M60 148 Q190 175 320 148 T580 148" stroke="#3B2A20" strokeWidth="1.5" fill="none" />
          {Array.from({ length: 13 }).map((_, i) => {
            const x = 70 + i * 40;
            const y = 148 + Math.sin((i / 12) * Math.PI * 2) * -8 + 12;
            return <circle key={i} cx={x} cy={y} r="5" fill="#FFD27A" opacity="0.95" />;
          })}
        </g>
      )}
      {/* awning */}
      <g>
        {Array.from({ length: 10 }).map((_, i) => (
          <path key={i} d={`M${60 + i * 52} 168 h52 l-6 44 h-40 z`} fill={stripes[i % 2]} />
        ))}
        <path d={Array.from({ length: 10 }).map((_, i) => `M${66 + i * 52} 212 q20 18 40 0`).join(" ")}
              fill={stripes[0]} stroke={stripes[0]} />
      </g>
      {/* lower facade */}
      <rect x="40" y="226" width="560" height="144" fill={vintage ? `url(#${id}-tile)` : facade} />
      {/* window */}
      <rect x="70" y="236" width="330" height="124" rx="4" fill={`url(#${id}-glow)`} stroke={vintage ? c2 : c1} strokeWidth="6" />
      <g opacity="0.85">
        {/* pendant lamps */}
        {[130, 235, 340].map((x) => (
          <g key={x}>
            <line x1={x} y1="238" x2={x} y2="262" stroke="#3B2A20" strokeWidth="1.5" />
            <path d={`M${x - 12} 272 q12 -18 24 0 z`} fill={vintage ? c2 : c1} />
            <circle cx={x} cy="274" r="4" fill="#FFF4D6" />
          </g>
        ))}
        {/* shelf with cups */}
        <rect x="90" y="300" width="120" height="5" fill="#5A3E2B" />
        {[100, 122, 144, 166, 188].map((x, i) => <rect key={x} x={x} y="288" width="14" height="12" rx="2" fill={[c2, c4, c3, c5, c2][i]} />)}
        {/* counter + espresso machine */}
        <rect x="230" y="318" width="160" height="42" fill="#5A3E2B" />
        <rect x="300" y="296" width="44" height="22" rx="3" fill={vintage ? c2 : "#8C8C8C"} />
        {/* plant */}
        <path d="M100 360 q-6 -30 10 -46 M110 360 q2 -26 18 -38 M104 360 q-18 -18 -16 -40" stroke={c4} strokeWidth="5" fill="none" strokeLinecap="round" />
        <rect x="92" y="344" width="26" height="16" rx="3" fill={c5} />
      </g>
      {vintage && (
        <text x="235" y="352" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontStyle="italic"
              fontSize="15" fill={c2}>est. 2026 · New York</text>
      )}
      {/* door */}
      <rect x="430" y="236" width="140" height="134" fill={vintage ? c5 : c1} />
      <rect x="448" y="252" width="104" height="80" rx="3" fill={`url(#${id}-glow)`} opacity="0.9" />
      <circle cx="540" cy="306" r="4" fill={c2} />
      <rect x="470" y="262" width="60" height="22" rx="4" fill="#F7F0E6" />
      <text x="500" y="278" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="12" fontWeight="700" fill={c1}>OPEN</text>
      {/* sidewalk */}
      <rect x="0" y="370" width="640" height="70" fill="#D8C7B1" />
      <path d="M0 384h640" stroke="#C5B29A" strokeWidth="2" />
      {/* A-frame chalkboard */}
      <g transform="translate(26 318)">
        <path d="M6 70 L20 0 L44 0 L58 70" stroke="#5A3E2B" strokeWidth="4" fill="none" />
        <rect x="14" y="6" width="36" height="46" rx="3" fill="#2E2A27" stroke="#5A3E2B" strokeWidth="3" />
        <text x="32" y="22" textAnchor="middle" fontSize="7" fill="#F7F0E6" fontFamily="DM Sans">TODAY</text>
        <text x="32" y="34" textAnchor="middle" fontSize="7" fill="#FFD27A" fontFamily="DM Sans">Maple</text>
        <text x="32" y="44" textAnchor="middle" fontSize="7" fill="#FFD27A" fontFamily="DM Sans">latte</text>
      </g>
      {/* planters */}
      {[412, 588].map((x) => (
        <g key={x}>
          <rect x={x - 14} y="350" width="28" height="22" rx="3" fill={vintage ? c4 : c5} />
          <circle cx={x} cy="340" r="16" fill={c4} />
          <circle cx={x - 9} cy="346" r="10" fill={vintage ? "#4F6B54" : "#7A8B6B"} />
        </g>
      ))}
      <text x="320" y="420" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="13" fill="#5A4335"
            letterSpacing="3">{tagline.toUpperCase()}</text>
    </svg>
  );
}

type FloorProps = { kind: "work" | "home" | "mixed" | "local"; palette: [string, string][]; className?: string };

export function FloorPlan({ kind, palette, className = "" }: FloorProps) {
  const [c1, c2, c3, c4] = palette.map((p) => p[1]);
  const table = (x: number, y: number, r = 14, chairs = 2, key?: string) => (
    <g key={key ?? `${x}-${y}`}>
      {Array.from({ length: chairs }).map((_, i) => {
        const a = (i / chairs) * Math.PI * 2;
        return <circle key={i} cx={x + Math.cos(a) * (r + 9)} cy={y + Math.sin(a) * (r + 9)} r="6" fill={c4} />;
      })}
      <circle cx={x} cy={y} r={r} fill={c2} stroke={c1} strokeWidth="2" />
    </g>
  );
  const label = (x: number, y: number, t: string) => (
    <text x={x} y={y} textAnchor="middle" fontSize="11" fontFamily="DM Sans" fill="#5A4335">{t}</text>
  );
  return (
    <svg viewBox="0 0 420 300" className={className} role="img" aria-label="Café floor plan">
      <rect x="10" y="10" width="400" height="280" rx="6" fill="#FBF7F1" stroke={c1} strokeWidth="5" />
      {/* door */}
      <rect x="180" y="284" width="60" height="12" fill="#FBF7F1" />
      <path d="M180 290 a60 60 0 0 1 60 -60" stroke={c1} strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
      {label(210, 278, "Entrance")}
      {/* counter */}
      <rect x="250" y="24" width="146" height="34" rx="4" fill={c1} />
      <rect x="362" y="24" width="34" height="120" rx="4" fill={c1} />
      <rect x="270" y="30" width="34" height="20" rx="3" fill={c3} />
      {label(296, 78, "Counter & espresso bar")}
      <rect x="300" y="160" width="96" height="26" rx="4" fill={c2} opacity=".7" />
      {label(348, 202, kind === "work" ? "Mobile pick-up" : "Pastry case")}
      {/* window */}
      <path d="M14 140 v120" stroke={c3} strokeWidth="8" />
      {kind === "work" && (
        <g>
          <rect x="22" y="140" width="22" height="120" rx="3" fill={c2} />
          {[150, 175, 200, 225, 250].map((y) => <circle key={y} cx="54" cy={y} r="6" fill={c4} />)}
          {label(84, 276, "Window standing bar")}
          {[[120, 60], [195, 60], [120, 125], [195, 125]].map(([x, y]) => table(x, y, 13, 2))}
          {label(158, 172, "2-person tables")}
        </g>
      )}
      {kind === "home" && (
        <g>
          {[[50, 60], [50, 110]].map(([x, y]) => (
            <g key={y}><rect x={x - 18} y={y - 16} width="36" height="32" rx="10" fill={c4} />
              <rect x={x - 12} y={y - 10} width="24" height="20" rx="6" fill={c2} opacity=".6" /></g>
          ))}
          <circle cx="92" cy="85" r="12" fill={c2} />
          {label(70, 148, "Lounge corner")}
          <rect x="130" y="110" width="110" height="34" rx="6" fill={c2} stroke={c1} strokeWidth="2" />
          {[140, 165, 190, 215].map((x) => <g key={x}><circle cx={x + 6} cy="100" r="6" fill={c4} /><circle cx={x + 6} cy="154" r="6" fill={c4} /></g>)}
          {label(185, 178, "Communal laptop table")}
          <rect x="22" y="200" width="16" height="70" rx="4" fill={c4} />
          {label(84, 240, "Window bench")}
          {[[130, 230], [190, 230]].map(([x, y]) => table(x, y, 12, 2))}
        </g>
      )}
      {(kind === "mixed" || kind === "local") && (
        <g>
          <rect x="22" y="150" width="18" height="110" rx="3" fill={c2} />
          {label(70, 142, "Window bar")}
          <rect x="120" y="60" width="100" height="30" rx="6" fill={c2} stroke={c1} strokeWidth="2" />
          {[128, 156, 184, 208].map((x) => <g key={x}><circle cx={x} cy="52" r="6" fill={c4} /><circle cx={x} cy="98" r="6" fill={c4} /></g>)}
          {label(170, 120, "Communal table")}
          {[[100, 190], [160, 190], [220, 230]].map(([x, y]) => table(x, y, 13, 2))}
          <rect x="250" y="220" width="40" height="34" rx="10" fill={c4} />
          {label(270, 270, "Cosy corner")}
        </g>
      )}
    </svg>
  );
}

export function HeroScene({ className = "" }: { className?: string }) {
  // a little city-block scene: three storefronts, one glowing (yours)
  return (
    <svg viewBox="0 0 520 300" className={className} aria-hidden>
      <defs>
        <linearGradient id="hero-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE3A8" /><stop offset="1" stopColor="#F2B76B" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="520" height="300" rx="28" fill="#EBDCC7" />
      <circle cx="430" cy="64" r="30" fill="#F2C88B" opacity=".8" />
      {/* skyline */}
      <path d="M0 150 h40 v-60 h30 v40 h26 v-90 h34 v70 h22 v-40 h30 v60 h40 v-110 h18 v-20 h10 v20 h18 v110 h30 v-50 h36 v40 h40 v-70 h30 v90 h60 v40 H0z"
            fill="#D9C4A8" />
      {/* left shop */}
      <rect x="20" y="120" width="140" height="150" fill="#B9A08A" />
      <rect x="34" y="180" width="70" height="70" fill="#9C8571" />
      <rect x="114" y="190" width="34" height="80" fill="#8B7462" />
      {/* your café */}
      <rect x="180" y="96" width="170" height="174" fill="#2F4A3A" />
      <rect x="192" y="110" width="146" height="30" rx="4" fill="#3B2A20" stroke="#B08D57" strokeWidth="2" />
      <text x="265" y="131" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="15" fill="#E2B98F">Your Café</text>
      {Array.from({ length: 6 }).map((_, i) => (
        <path key={i} d={`M${184 + i * 27.5} 148 h27.5 l-4 26 h-19.5z`} fill={i % 2 ? "#F7F0E6" : "#B5654A"} />
      ))}
      <rect x="194" y="184" width="88" height="70" rx="3" fill="url(#hero-glow)" stroke="#B08D57" strokeWidth="3" />
      <rect x="292" y="184" width="46" height="86" fill="#5A3E2B" />
      <rect x="298" y="192" width="34" height="40" rx="2" fill="url(#hero-glow)" />
      <circle cx="238" cy="200" r="5" fill="#FFF4D6" />
      {/* right shop */}
      <rect x="370" y="134" width="130" height="136" fill="#C2A88E" />
      <rect x="384" y="190" width="60" height="60" fill="#A88F78" />
      <rect x="452" y="200" width="34" height="70" fill="#957D68" />
      {/* street */}
      <rect x="0" y="270" width="520" height="30" fill="#CDB89D" />
      <circle cx="120" cy="262" r="12" fill="#8A9A7B" /><rect x="113" y="262" width="14" height="10" fill="#B5654A" />
      <circle cx="362" cy="262" r="12" fill="#8A9A7B" /><rect x="355" y="262" width="14" height="10" fill="#B5654A" />
      {/* map pin above your café */}
      <g transform="translate(265 40)">
        <path d="M0 44 C-18 20 -18 0 0 0 C18 0 18 20 0 44z" fill="#B5654A" />
        <circle cx="0" cy="15" r="7" fill="#F7F0E6" />
      </g>
    </svg>
  );
}
