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

/** Constellation (v0.38.0) : NJMDev au centre, une application par nœud ; l'anneau montre la disponibilité sur 24 h. */
export function Constellation({ apps, selected, focus, onSelect, onFocus }: { apps: AppOverview[]; selected: string | null; focus: string | null; onSelect: (k: string) => void; onFocus: (k: string | null) => void }) {
  const cx = 300, cy = 298, rx = 205, ry = 208, R = 42, C = 2 * Math.PI * R;
  const known = apps.filter((a) => a.key in ANGLES);
  const rest = apps.filter((a) => !(a.key in ANGLES));
  const placed = [...known.map((a) => ({ a, ang: ANGLES[a.key] })), ...rest.map((a, i) => ({ a, ang: -90 + (360 / Math.max(1, rest.length)) * i }))].map(({ a, ang }) => ({ a, x: cx + rx * Math.cos((ang * Math.PI) / 180), y: cy + ry * Math.sin((ang * Math.PI) / 180) }));
  const f = focus ?? selected;
  return (
    <svg className="constellation" viewBox="0 0 600 600" role="img" aria-label="Constellation des applications">
      {[1, 0.6].map((k) => <ellipse key={k} cx={cx} cy={cy} rx={rx * k} ry={ry * k} fill="none" stroke="var(--border)" strokeDasharray="2 6" />)}
      {placed.map(({ a, x, y }, i) => (
        <line key={a.key} x1={cx} y1={cy} x2={x} y2={y} stroke={`var(--${tone(a.status) === "off" ? "muted" : tone(a.status)})`} strokeWidth={1.4} opacity={0.55} className="c-flow" style={{ animationDuration: `${a.status === "ok" ? 1.4 + i * 0.15 : 3.2}s` }} />
      ))}
      <g>
        <circle cx={cx} cy={cy} r={50} fill="var(--surface)" stroke="var(--text)" strokeWidth={1.4} />
        <circle cx={cx} cy={cy} r={62} fill="none" stroke="var(--text)" strokeOpacity={0.25} strokeDasharray="4 8" className="c-flow" style={{ animationDuration: "6s" }} />
        <image href="/brand/njmdev-white.png" x={cx - 26} y={cy - 26} width={52} height={52} className="c-hub" />
      </g>
      {placed.map(({ a, x, y }) => {
        const t = tone(a.status);
        const col = `var(--${t === "off" ? "muted" : t})`;
        const up = cheapUptime(a);
        const lat = latency(a);
        const l = LOGOS[a.key];
        return (
          <g key={a.key} className={`c-node${f && f !== a.key ? " dim" : ""}${f === a.key ? " focus" : ""}`} tabIndex={0} role="button" aria-label={a.name} onClick={() => onSelect(a.key)} onKeyDown={(e) => e.key === "Enter" && onSelect(a.key)} onPointerEnter={() => onFocus(a.key)} onPointerLeave={() => onFocus(null)}>
            {t !== "ok" && t !== "off" && <circle cx={x} cy={y} r={42} fill={col} opacity={0.2} className="c-pulse" />}
            <circle cx={x} cy={y} r={36} fill="var(--surface)" stroke="var(--border)" />
            <circle cx={x} cy={y} r={R} fill="none" stroke="var(--border)" strokeWidth={3} />
            <circle cx={x} cy={y} r={R} fill="none" stroke={col} strokeWidth={3} strokeLinecap="round" strokeDasharray={up !== null ? `${(C * up) / 100} ${C}` : "2 5"} transform={`rotate(-90 ${x} ${y})`} className="c-ring" />
            {l && "src" in l ? (l.wide ? <image href={l.src} x={x - 30} y={y - 11} width={60} height={22} preserveAspectRatio="xMidYMid meet" /> : <image href={l.src} x={x - 20} y={y - 20} width={40} height={40} />) : (
              <text x={x} y={y + 7} textAnchor="middle" className="c-ini">{l && "initials" in l ? l.initials : a.name.slice(0, 2).toUpperCase()}</text>
            )}
            <text x={x} y={y + 62} textAnchor="middle" className="c-lbl">{a.name}</text>
            <text x={x} y={y + 77} textAnchor="middle" className="c-sub" fill={col}>{a.status === "paused" ? "en pause" : a.status === "not_deployed" ? "non déployée" : lat !== null ? `${lat} ms` : "—"}</text>
          </g>
        );
      })}
    </svg>
  );
}
