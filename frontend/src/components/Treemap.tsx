import { useEffect, useRef, useState } from "react";
import { AppMark } from "./Constellation";

export interface TreeItem {
  key: string;
  name: string;
  value: number;
  tone: "ok" | "warn" | "bad" | "off";
  label: string;
  sub?: string;
}

interface Rect {
  it: TreeItem;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Découpage récursif équilibré (cases proportionnelles aux valeurs). */
function layout(items: TreeItem[], x: number, y: number, w: number, h: number): Rect[] {
  if (items.length === 1) return [{ it: items[0], x, y, w, h }];
  const total = items.reduce((s, i) => s + i.value, 0);
  let acc = 0;
  let k = 0;
  for (; k < items.length - 1; k++) {
    if (acc + items[k].value > total / 2 && k > 0) break;
    acc += items[k].value;
  }
  if (k === 0) {
    k = 1;
    acc = items[0].value;
  }
  const a = items.slice(0, k);
  const b = items.slice(k);
  const fa = acc / total;
  return w >= h ? [...layout(a, x, y, w * fa, h), ...layout(b, x + w * fa, y, w * (1 - fa), h)] : [...layout(a, x, y, w, h * fa), ...layout(b, x, y + h * fa, w, h * (1 - fa))];
}

/** Carte à cases (v0.40.0) : la taille d'une case suit la valeur, sa couleur l'état ; un clic ouvre l'appli. */
export function Treemap({ items, onPick, height = 360 }: { items: TreeItem[]; onPick?: (key: string) => void; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const rects = width && items.length ? layout([...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value), 0, 0, width, height) : [];
  return (
    <div className="treemap" ref={box} style={{ height }}>
      {rects.map(({ it, x, y, w, h }) => (
        <div key={it.key} className="tm-cell" style={{ left: x, top: y, width: w, height: h }}>
          <button className={`tm-in tm-${it.tone}`} onClick={() => onPick?.(it.key)}>
            <span className="tm-logo"><AppMark appKey={it.key} size={26} /></span>
            <strong>{it.name}</strong>
            <span className="tm-big">{it.label}</span>
            {it.sub && <span className="muted small">{it.sub}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}
