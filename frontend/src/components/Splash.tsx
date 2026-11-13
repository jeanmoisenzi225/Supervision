import { useEffect, useState } from "react";
import { isNewOpening } from "../lib/launch";

// Page de démarrage de NJMDev (v0.33.0), même durée que celle de Procedia : l'animation du logo
// dure 4 s (y compris si les animations sont réduites), puis l'écran s'efface en 0,4 s.
// Affichée à chaque ouverture de l'application installée (écran d'accueil, fenêtre dédiée) ;
// `?splash=1` la force dans un navigateur pour la voir.
const LOGO_MS = 4000;

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
      <div className="splash-logo">
        {/* Le logo se dessine par trois balayages successifs : le N, le JM puis le soulignement. */}
        <img className="splash-part splash-part-n" src="/brand/njmdev-white.png" alt="" />
        <img className="splash-part splash-part-jm" src="/brand/njmdev-white.png" alt="" />
        <img className="splash-part splash-part-line" src="/brand/njmdev-white.png" alt="" />
        <span className="splash-shine" aria-hidden="true" />
      </div>
      <p className="splash-name">NJMDev</p>
      <p className="splash-tag">Supervision · Facturation</p>
      <span className="splash-bar" aria-hidden="true" />
    </div>
  );
}
