import { useEffect, useRef, useState } from "react";
import { requestRefresh } from "../lib/refresh";

const THRESHOLD = 64; // distance (px, après amortissement) à partir de laquelle on actualise
const MAX_PULL = 110;
const BUSY_MS = 900;

/** Vrai si le doigt est dans une zone qui défile déjà (liste, tableau…) : on laisse défiler. */
function insideScrolledArea(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight && node.scrollTop > 0) return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * Geste « tirer pour actualiser » : en haut de la page, glisser vers le bas puis relâcher
 * recharge les données affichées (utile surtout sur l'appli installée, sans bouton d'actualisation).
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const gesture = useRef({ active: false, startY: 0, pull: 0 });
  const busyRef = useRef(false);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const g = gesture.current;
      g.active = e.touches.length === 1 && window.scrollY <= 0 && !busyRef.current && !insideScrolledArea(e.target);
      g.startY = e.touches[0]?.clientY ?? 0;
      g.pull = 0;
    };
    const onMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (!g.active) return;
      const dy = (e.touches[0]?.clientY ?? 0) - g.startY;
      if (dy <= 0 || window.scrollY > 0) {
        if (g.pull !== 0) {
          g.pull = 0;
          setPull(0);
        }
        return;
      }
      g.pull = Math.min(MAX_PULL, dy * 0.5);
      setPull(g.pull);
      if (e.cancelable) e.preventDefault(); // évite le rebond de la page pendant le geste
    };
    const onEnd = () => {
      const g = gesture.current;
      if (!g.active) return;
      g.active = false;
      if (g.pull >= THRESHOLD) {
        busyRef.current = true;
        setBusy(true);
        setPull(THRESHOLD);
        requestRefresh();
        window.setTimeout(() => {
          busyRef.current = false;
          setBusy(false);
          setPull(0);
        }, BUSY_MS);
      } else {
        setPull(0);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const visible = pull > 4 || busy;
  const ready = pull >= THRESHOLD;
  const label = busy ? "Actualisation…" : ready ? "Relâcher pour actualiser" : "Tirer pour actualiser";
  return (
    <div
      className={`ptr${visible ? " ptr-visible" : ""}${busy ? " ptr-busy" : ""}${ready ? " ptr-ready" : ""}`}
      style={{ transform: `translate(-50%, ${Math.max(0, pull) - 44}px)`, opacity: busy ? 1 : Math.min(1, pull / THRESHOLD) }}
      role="status"
      aria-live="polite"
    >
      <span className="ptr-icon" aria-hidden="true">
        {busy ? "↻" : "↓"}
      </span>
      <span>{visible ? label : ""}</span>
    </div>
  );
}
