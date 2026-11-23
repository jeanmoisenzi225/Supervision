/** Petites icônes au trait, dans le style du reste de l'interface (même épaisseur que la loupe et l'engrenage). */
const base = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "ico" } as const;

/** Sablier : en attente. */
export const Hourglass = () => (
  <svg {...base}>
    <path d="M7 3h10M7 21h10M8 3v3a4 4 0 0 0 1.6 3.2L12 12l-2.4 2.8A4 4 0 0 0 8 18v3M16 3v3a4 4 0 0 1-1.6 3.2L12 12l2.4 2.8A4 4 0 0 1 16 18v3" />
  </svg>
);

/** Coche : terminé. */
export const CheckMark = () => (
  <svg {...base}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);
