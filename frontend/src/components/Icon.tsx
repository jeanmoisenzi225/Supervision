import type { CSSProperties } from "react";

/** Icônes au trait, dans le style du reste de l'interface (même épaisseur que la loupe et l'engrenage). */
type P = { size?: number; style?: CSSProperties };
const base = (size = 15, style?: CSSProperties) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "ico", style });

/** Sablier : en attente. */
export const Hourglass = ({ size, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M7 3h10M7 21h10M8 3v3a4 4 0 0 0 1.6 3.2L12 12l-2.4 2.8A4 4 0 0 0 8 18v3M16 3v3a4 4 0 0 1-1.6 3.2L12 12l2.4 2.8A4 4 0 0 1 16 18v3" />
  </svg>
);

/** Coche : terminé. */
export const CheckMark = ({ size, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);

/** Cercle vide : pas encore fait. */
export const Circle = ({ size, style }: P) => (
  <svg {...base(size, style)}>
    <circle cx="12" cy="12" r="7.5" />
  </svg>
);

/** Triangle d'avertissement. */
export const Warning = ({ size, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M12 3.6l9.2 16H2.8L12 3.6zM12 10v4.4M12 17.2v.1" />
  </svg>
);

/** Pastille d'état (critique, avertissement, ok, information). */
export const Dot = ({ level, size = 9 }: { level: "critical" | "warning" | "ok" | "info"; size?: number }) => {
  const color = level === "critical" ? "var(--bad)" : level === "warning" ? "var(--warn)" : level === "ok" ? "var(--ok)" : "var(--muted)";
  return <span className="ico-dot" aria-hidden="true" style={{ width: size, height: size, background: level === "info" ? "transparent" : color, border: level === "info" ? `1.6px solid ${color}` : "none" }} />;
};
