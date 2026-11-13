import { useEffect, useState } from "react";
import { isNewOpening } from "../lib/launch";

// Page de démarrage de NJMDev (v0.33.0), même durée que celle de Procedia : 4 s (y compris si les
// animations sont réduites), puis l'écran s'efface en 0,4 s. Le logo est posé, sans animation ;
// seule la barre de chargement, sous le logo, se remplit (v0.33.2).
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

  // Pendant la page de démarrage, le fond de la page prend sa couleur : aucune bande d'une autre teinte ne peut apparaître.
  useEffect(() => {
    if (!show) return;
    const root = document.documentElement;
    const before = root.style.backgroundColor;
    root.style.backgroundColor = "#0a1033";
    return () => {
      root.style.backgroundColor = before;
    };
  }, [show]);

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
      <img className="splash-logo" src="/brand/njmdev-white.png" alt="" />
      <span className="splash-bar" aria-hidden="true">
        <span className="splash-fill" />
      </span>
    </div>
  );
}
