// Application installée (PWA) : aucun réflexe de navigateur web (v0.62.4 / Supervision v0.36.0).
// Pas de zoom (pincer, double toucher, Ctrl + molette), pas de sélection de texte, pas de menu
// contextuel ni d'aperçu de lien à l'appui long, pas de glisser d'images ni de liens, pas de
// rebond de défilement du navigateur. Les champs de saisie et les zones marquées `selectable`
// restent utilisables. Hors application installée, rien ne change (le zoom reste possible dans
// un navigateur, pour l'accessibilité).
export function isStandalone(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true'], .selectable";

export function installNativeFeel(): void {
  if (!isStandalone()) return;
  const root = document.documentElement;
  root.classList.add("standalone");
  const stop = (e: Event) => e.preventDefault();
  // Pincer pour zoomer (Safari iOS : événements « gesture » ; touchmove avec échelle).
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(type, stop, { passive: false });
  document.addEventListener(
    "touchmove",
    (e) => {
      const scale = (e as TouchEvent & { scale?: number }).scale;
      if (scale !== undefined && scale !== 1) e.preventDefault();
    },
    { passive: false },
  );
  // Ctrl + molette ou pincement du pavé tactile (ordinateur).
  document.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault(); });
  // Pas de menu contextuel du navigateur, sauf dans les champs de saisie.
  document.addEventListener("contextmenu", (e) => { if (!(e.target instanceof Element && e.target.closest(EDITABLE))) e.preventDefault(); });
  // Pas de glisser d'images ni de liens.
  document.addEventListener("dragstart", (e) => { if (!(e.target instanceof Element && e.target.closest(EDITABLE))) e.preventDefault(); });
}
