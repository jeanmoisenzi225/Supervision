import { useMemo, useRef, useState } from "react";

type Points = [number, number][];

interface Props {
  title: string;
  points: Points;
  format: (v: number) => string;
  /** Ligne de référence (limite du plan, taille du disque…), pointillée. */
  limit?: { value: number; label: string } | null;
  /** Seuil d'alerte, affiché en pointillé orange. */
  threshold?: { value: number; label: string } | null;
  rangeHours: number;
}

const W = 600;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 52 };

function timeLabel(t: number, rangeHours: number): string {
  const d = new Date(t);
  // Sur 24 h, les deux bornes ont la même heure : la date les distingue.
  return rangeHours <= 24
    ? d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** Courbe d'une seule série, avec limite et seuil facultatifs, réticule et infobulle au survol ou au toucher. */
export function LineChart({ title, points, format, limit, threshold, rangeHours }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const t0 = points[0][0];
    const t1 = points[points.length - 1][0] || t0 + 1;
    const maxData = Math.max(...points.map((p) => p[1]));
    const yMax = Math.max(maxData, limit?.value ?? 0, threshold?.value ?? 0) * 1.08 || 1;
    const x = (t: number) => PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - v / yMax) * (H - PAD.top - PAD.bottom);
    const line = points.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const area = `${line}L${x(t1).toFixed(1)},${y(0)}L${x(t0).toFixed(1)},${y(0)}Z`;
    const ticks = [0, 0.5, 1].map((f) => f * yMax);
    return { x, y, line, area, ticks, t0, t1 };
  }, [points, limit, threshold]);

  if (!geo) {
    return (
      <figure className="chart">
        <figcaption>{title}</figcaption>
        <p className="muted small">Pas de mesure sur cette période.</p>
      </figure>
    );
  }

  function onMove(clientX: number) {
    const svg = svgRef.current;
    if (!svg || !geo) return;
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(geo.x(points[i][0]) - vx) < Math.abs(geo.x(points[best][0]) - vx)) best = i;
    setHover(best);
  }

  const latest = points[points.length - 1][1];
  const hp = hover !== null ? points[hover] : null;

  return (
    <figure className="chart">
      <figcaption>
        {title} <span className="muted">· actuellement {format(latest)}</span>
      </figcaption>
      <div className="chart-box">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title} : actuellement ${format(latest)}, maximum ${format(Math.max(...points.map((p) => p[1])))}`}
          // Événements de pointeur : souris et doigt traités de la même façon.
          // Au doigt, l'infobulle reste affichée après le toucher (elle
          // disparaîtrait sinon aussitôt) ; à la souris, elle suit le curseur.
          onPointerDown={(e) => onMove(e.clientX)}
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setHover(null);
          }}
        >
          {geo.ticks.map((v) => (
            <g key={v}>
              <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={geo.y(v)} y2={geo.y(v)} />
              <text className="axis" x={PAD.left - 6} y={geo.y(v) + 4} textAnchor="end">
                {format(v)}
              </text>
            </g>
          ))}
          <text className="axis" x={PAD.left} y={H - 4}>
            {timeLabel(geo.t0, rangeHours)}
          </text>
          <text className="axis" x={W - PAD.right} y={H - 4} textAnchor="end">
            {timeLabel(geo.t1, rangeHours)}
          </text>
          {limit && (
            <g>
              <line className="ref-line" x1={PAD.left} x2={W - PAD.right} y1={geo.y(limit.value)} y2={geo.y(limit.value)} />
              <text className="ref-label" x={W - PAD.right} y={geo.y(limit.value) - 4} textAnchor="end">
                {limit.label}
              </text>
            </g>
          )}
          {threshold && (
            <g>
              <line className="threshold-line" x1={PAD.left} x2={W - PAD.right} y1={geo.y(threshold.value)} y2={geo.y(threshold.value)} />
              <text className="threshold-label" x={PAD.left + 4} y={geo.y(threshold.value) - 4}>
                {threshold.label}
              </text>
            </g>
          )}
          <path className="series-area" d={geo.area} />
          <path className="series-line" d={geo.line} />
          {hp && (
            <g>
              <line className="crosshair" x1={geo.x(hp[0])} x2={geo.x(hp[0])} y1={PAD.top} y2={H - PAD.bottom} />
              <circle className="series-dot" cx={geo.x(hp[0])} cy={geo.y(hp[1])} r={5} />
            </g>
          )}
        </svg>
        {hp && (
          <div className="chart-tip" style={{ left: `${(geo.x(hp[0]) / W) * 100}%` }}>
            <strong>{format(hp[1])}</strong>
            <span>{new Date(hp[0]).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
