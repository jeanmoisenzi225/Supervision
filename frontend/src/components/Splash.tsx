import { useEffect, useState } from "react";
import { isNewOpening } from "../lib/launch";

// Page de démarrage de NJMDev (v0.33.0), même durée que celle de Procedia : l'animation dure 4 s
// (y compris si les animations sont réduites), puis l'écran s'efface en 0,4 s.
// Le logo se dessine trait après trait (v0.33.1) : d'abord le trait du bas, puis celui juste
// au-dessus en partant de sa droite, et on fait le tour du logo jusqu'à sa fin, tout à droite.
// Seule une barre de chargement s'affiche sous le logo.
// Affichée à chaque ouverture de l'application installée (écran d'accueil, fenêtre dédiée) ;
// `?splash=1` la force dans un navigateur pour la voir.
const LOGO_MS = 4000;
// Le tracé occupe de 0,2 s à 3,8 s ; chaque trait dure en proportion de sa longueur.
const DRAW_START = 0.2;
const DRAW_END = 3.8;

// Lignes médianes du logo (viewBox 505 × 315), dans l'ordre du dessin. Épaisseur du masque : 34
// pour un trait de 22, afin de découvrir aussi les angles.
const STROKES: { d: string; len: number }[] = [
  { d: "M 8 292 H 266", len: 258 }, // trait du bas (soulignement), de gauche à droite
  { d: "M 199 245 H 8", len: 191 }, // trait juste au-dessus, depuis sa droite
  { d: "M 26.5 264 V 8", len: 256 }, // côté gauche, vers le haut
  { d: "M 12 10 L 252 258", len: 345 }, // diagonale du N, vers le bas à droite
  { d: "M 248 264 V 33", len: 231 }, // côté gauche du carré, vers le haut
  { d: "M 234 33 H 494", len: 260 }, // haut du carré, vers la droite
  { d: "M 478 12 V 264", len: 252 }, // côté droit, vers le bas
  { d: "M 494 245 H 298", len: 196 }, // bas du carré, vers la gauche
  { d: "M 254 29 L 484 258", len: 325 }, // diagonale du carré, jusqu'à la fin tout à droite
];

const total = STROKES.reduce((t, s) => t + s.len, 0);
let at = DRAW_START;
const TIMED = STROKES.map((s) => {
  const dur = ((DRAW_END - DRAW_START) * s.len) / total;
  const item = { ...s, delay: Math.round(at * 1000) / 1000, dur: Math.round(dur * 1000) / 1000 };
  at += dur;
  return item;
});

const forced = () => {
  try {
    return new URLSearchParams(window.location.search).get("splash") === "1";
  } catch {
    return false;
  }
};

function shouldShow(): boolean {
  try {
    return forced() || isNewOpening();
  } catch {
    return false;
  }
}

export function Splash() {
  const [show] = useState(shouldShow);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!show) return;
    const a = window.setTimeout(() => setLeaving(true), LOGO_MS);
    const b = window.setTimeout(() => setGone(true), LOGO_MS + 420);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [show]);

  if (!show || gone) return null;
  return (
    <div className={`splash${leaving ? " is-leaving" : ""}`} role="status" aria-label="NJMDev démarre">
      <svg className="splash-logo" viewBox="0 0 505 315" aria-hidden="true">
        <defs>
          <mask id="splash-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="505" height="315">
            {TIMED.map((s, i) => (
              <path key={i} className="splash-draw" d={s.d} pathLength={1} style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
            ))}
          </mask>
        </defs>
        <image href="/brand/njmdev-white.png" x="0" y="0" width="505" height="315" mask="url(#splash-reveal)" />
      </svg>
      <span className="splash-bar" aria-hidden="true">
        <span className="splash-fill" />
      </span>
    </div>
  );
}
