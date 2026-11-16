import { useEffect, useRef, useState } from "react";
import type { AppOverview, ReplayData } from "../lib/api";
import { AppMark } from "./Constellation";

const clock = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const lvlColor = (l: string) => (l === "critical" ? "var(--bad)" : l === "warning" ? "var(--warn)" : l === "ok" ? "var(--ok)" : "var(--muted)");

/**
 * Rejeu (v0.39.0) : une ligne par appli, case par case (vert = nominal, ambre = dégradé, rouge = arrêt).
 * On fait glisser le curseur, ou on lance la lecture, et le reste de la page (constellation, titre) suit.
 * `t` = case affichée (null = maintenant) ; `onT` est appelé à chaque changement.
 */
export function Replay({ data, apps, t, onT, hours }: { data: ReplayData; apps: AppOverview[]; t: number | null; onT: (t: number | null) => void; hours: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(240);
  const pos = useRef(data.n - 1);
  const drag = useRef(false);
  const n = data.n;
  const cur = t ?? n - 1;
  pos.current = cur;
  const at = (c: number) => data.from + c * data.stepMin * 60_000;
  const nameOf = (k: string) => apps.find((a) => a.key === k)?.name ?? k;

  useEffect(() => {
    if (!playing) return;
    let last = 0;
    let raf = 0;
    const tick = (ts: number) => {
      if (last) pos.current += ((ts - last) / 1000) * speed / (data.stepMin * 60);
      last = ts;
      if (pos.current >= n - 1) {
        setPlaying(false);
        onT(null);
        return;
      }
      onT(Math.floor(pos.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, n, data.stepMin, onT]);

  const fromEvent = (clientX: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const c = Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (n - 1));
    onT(c >= n - 1 ? null : c);
  };
  useEffect(() => {
    const move = (e: PointerEvent) => drag.current && fromEvent(e.clientX);
    const up = () => (drag.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  const spanCells = Math.max(2, Math.round((40 / data.stepMin)));
  const near = data.events.filter((e) => Math.abs((e.at - at(cur)) / (data.stepMin * 60_000)) <= spanCells).slice(0, 6);
  const ticks = [0, 1, 2, 3].map((i) => ({ p: (i / 3) * 100, label: i === 3 ? "maintenant" : clock(data.from + (i / 3) * (data.to - data.from)) }));

  return (
    <div className="replay">
      <div className="replay-head">
        <div>
          <div className="muted small mono">{t === null ? "maintenant" : `il y a ${Math.round(((n - 1 - cur) * data.stepMin) / 6) / 10} h`}</div>
          <div className="replay-clock">{clock(at(cur))}</div>
        </div>
        <div className="replay-ctrl">
          <button className={playing ? "primary" : ""} onClick={() => (playing ? setPlaying(false) : (pos.current >= n - 1 && onT(Math.floor(n * 0.35)), setPlaying(true)))}>
            {playing ? "❚❚ Pause" : "▶ Rejouer"}
          </button>
          {[240, 900].map((s) => (
            <button key={s} className={speed === s ? "primary" : ""} onClick={() => setSpeed(s)}>
              ×{s}
            </button>
          ))}
          <button onClick={() => (setPlaying(false), onT(null))} disabled={t === null}>
            Maintenant
          </button>
        </div>
      </div>
      <div className="replay-lanes">
        <div className="replay-names">
          {data.apps.map((a) => (
            <div key={a.key} className="replay-name" title={nameOf(a.key)}>
              <AppMark appKey={a.key} size={16} />
              <span>{nameOf(a.key)}</span>
            </div>
          ))}
        </div>
        <div className="replay-box" ref={boxRef} onPointerDown={(e) => ((drag.current = true), setPlaying(false), fromEvent(e.clientX))}>
          {data.apps.map((a) => (
            <div key={a.key} className="replay-row" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {a.cells.map((c, i) => (
                <i key={i} className={c.s ?? "none"} />
              ))}
              {data.events
                .filter((e) => e.appKey === a.key)
                .map((e, i) => (
                  <b key={i} className="replay-ev" style={{ left: `${(((e.at - data.from) / (data.to - data.from)) * 100).toFixed(2)}%`, background: lvlColor(e.level) }} title={`${clock(e.at)} · ${e.title}`} />
                ))}
            </div>
          ))}
          <div className="replay-cursor" style={{ left: `${(cur / (n - 1)) * 100}%` }} />
        </div>
      </div>
      <div className="replay-axis">
        {ticks.map((tk) => (
          <span key={tk.p} className="mono small muted">
            {tk.label}
          </span>
        ))}
      </div>
      <div className="replay-evs">
        {near.length === 0 ? (
          <div className="replay-evrow muted small">Rien de notable à ce moment-là.</div>
        ) : (
          near.map((e, i) => (
            <div key={i} className="replay-evrow">
              <span className="mono small muted">{clock(e.at)}</span>
              <span className="dot-mini" style={{ background: lvlColor(e.level) }} />
              <span>
                <strong>{nameOf(e.appKey)}</strong> · {e.title}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="muted small">Les {hours} dernières heures, une case toutes les {data.stepMin} minutes. Glissez le curseur ou lancez la lecture.</div>
    </div>
  );
}
