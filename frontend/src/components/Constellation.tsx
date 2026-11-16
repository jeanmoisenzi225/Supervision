import type { AppOverview } from "../lib/api";

/** Logos des projets (public/logos) ; My Family n'en a pas encore : pastille à initiales. */
export const LOGOS: Record<string, { src: string; wide?: boolean } | { initials: string }> = {
  mga: { src: "/logos/mga.svg" },
  "site-autonova": { src: "/logos/autonova.png", wide: true },
  yiri: { src: "/logos/yiri.png" },
  "my-family": { initials: "MF" },
  "eden-sup": { src: "/logos/eden.svg" },
  procedia: { src: "/logos/procedia.svg" },
};
const ANGLES: Record<string, number> = { mga: -150, "site-autonova": -90, yiri: -30, "my-family": 30, "eden-sup": 90, procedia: 150 };

export function AppMark({ appKey, size = 28 }: { appKey: string; size?: number }) {
  const l = LOGOS[appKey];
  if (!l) return <span className="mark-ini" style={{ width: size, height: size, fontSize: size * 0.38 }}>{appKey.slice(0, 2).toUpperCase()}</span>;
  if ("initials" in l) return <span className="mark-ini" style={{ width: size, height: size, fontSize: size * 0.38 }}>{l.initials}</span>;
  return <img src={l.src} alt="" style={{ height: size, width: l.wide ? "auto" : size, maxWidth: l.wide ? size * 2.6 : undefined, objectFit: "contain", borderRadius: size * 0.16 }} />;
}

const tone = (s: AppOverview["status"]) => (s === "ok" ? "ok" : s === "degraded" ? "warn" : s === "down" ? "bad" : "off");
const cheapUptime = (a: AppOverview): number | null => {
  const v = a.checks.map((c) => c.uptime24h).filter((x): x is number => x !== null);
  return v.length ? Math.min(...v) : null;
};
const latency = (a: AppOverview): number | null => {
  const v = a.checks.map((c) => c.last?.latencyMs).filter((x): x is number => typeof x === "number");
  return v.length ? Math.max(...v) : null;
};

/** Constellation (v0.38.0, plus grande et lumineuse en v0.41.0) : NJMDev au centre, une application par nœud ; l'anneau montre la disponibilité sur 24 h. */
export type StateOverride = Record<string, { status: AppOverview["status"]; ms: number | null }>;

export function Constellation({ apps, selected, focus, onSelect, onFocus, overrides }: { apps: AppOverview[]; selected: string | null; focus: string | null; onSelect: (k: string) => void; onFocus: (k: string | null) => void; overrides?: StateOverride | null }) {
  const eff = (a: AppOverview) => overrides?.[a.key]?.status ?? a.status;
  const cx = 300, cy = 300, rx = 222, ry = 214, R = 50, NODE = 44, C = 2 * Math.PI * R;
  const known = apps.filter((a) => a.key in ANGLES);
  const rest = apps.filter((a) => !(a.key in ANGLES));
  const placed = [...known.map((a) => ({ a, ang: ANGLES[a.key] })), ...rest.map((a, i) => ({ a, ang: -90 + (360 / Math.max(1, rest.length)) * i }))].map(({ a, ang }) => ({ a, x: cx + rx * Math.cos((ang * Math.PI) / 180), y: cy + ry * Math.sin((ang * Math.PI) / 180) }));
  const f = focus ?? selected;
  const colOf = (a: AppOverview) => {
    const t = tone(eff(a));
    return `var(--${t === "off" ? "muted" : t})`;
  };
  return (
    <svg className="constellation" viewBox="0 0 600 600" role="img" aria-label="Constellation des applications">
      <defs>
        <filter id="c-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="c-soft" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <radialGradient id="c-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--text)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--text)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={150} fill="url(#c-hub)" className="c-breath" />
      {[1, 0.6].map((k) => <ellipse key={k} cx={cx} cy={cy} rx={rx * k} ry={ry * k} fill="none" stroke="var(--border)" strokeWidth={1.2} strokeDasharray="2 6" />)}
      {placed.map(({ a, x, y }, i) => (
        <g key={a.key} className={f && f !== a.key ? "dim-line" : ""}>
          <line x1={cx} y1={cy} x2={x} y2={y} stroke={colOf(a)} strokeWidth={2} opacity={0.75} filter="url(#c-glow)" className="c-flow" style={{ animationDuration: `${eff(a) === "ok" ? 1.4 + i * 0.15 : 3.2}s` }} />
        </g>
      ))}
      <g>
        <circle cx={cx} cy={cy} r={64} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.8} filter="url(#c-glow)" />
        <circle cx={cx} cy={cy} r={78} fill="none" stroke="var(--text)" strokeOpacity={0.35} strokeDasharray="4 8" className="c-flow" style={{ animationDuration: "6s" }} />
        <image href="/brand/njmdev-white.png" x={cx - 33} y={cy - 33} width={66} height={66} className="c-hub" />
      </g>
      {placed.map(({ a, x, y }) => {
        const t = tone(eff(a));
        const col = colOf(a);
        const up = cheapUptime(a);
        const lat = overrides?.[a.key] ? overrides[a.key].ms : latency(a);
        const l = LOGOS[a.key];
        return (
          <g key={a.key} className={`c-node${f && f !== a.key ? " dim" : ""}${f === a.key ? " focus" : ""}`} tabIndex={0} role="button" aria-label={a.name} onClick={() => onSelect(a.key)} onKeyDown={(e) => e.key === "Enter" && onSelect(a.key)} onPointerEnter={() => onFocus(a.key)} onPointerLeave={() => onFocus(null)}>
            <circle cx={x} cy={y} r={66} fill={col} opacity={t === "off" ? 0.06 : 0.22} filter="url(#c-soft)" className={t === "ok" ? "c-halo" : "c-pulse"} />
            <circle cx={x} cy={y} r={NODE} fill="var(--surface)" stroke="var(--border)" />
            <circle cx={x} cy={y} r={R} fill="none" stroke="var(--border)" strokeWidth={3.5} />
            <circle cx={x} cy={y} r={R} fill="none" stroke={col} strokeWidth={4} strokeLinecap="round" strokeDasharray={up !== null ? `${(C * up) / 100} ${C}` : "2 6"} transform={`rotate(-90 ${x} ${y})`} className="c-ring" filter={t === "off" ? undefined : "url(#c-glow)"} />
            {l && "src" in l ? (l.wide ? <image href={l.src} x={x - 36} y={y - 14} width={72} height={28} preserveAspectRatio="xMidYMid meet" /> : <image href={l.src} x={x - 25} y={y - 25} width={50} height={50} />) : (
              <text x={x} y={y + 8} textAnchor="middle" className="c-ini">{l && "initials" in l ? l.initials : a.name.slice(0, 2).toUpperCase()}</text>
            )}
            <text x={x} y={y + 74} textAnchor="middle" className="c-lbl">{a.name}</text>
            <text x={x} y={y + 90} textAnchor="middle" className="c-sub" fill={col}>{eff(a) === "paused" ? "en pause" : eff(a) === "not_deployed" ? "non déployée" : lat !== null ? `${lat} ms` : "—"}</text>
          </g>
        );
      })}
    </svg>
  );
}
