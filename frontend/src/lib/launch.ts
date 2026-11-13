// Application installée : détection d'une nouvelle ouverture (page de démarrage NJMDev, v0.33.0).
const OPENED = "njmdev.opened";

export function isInstalled(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

let cached: boolean | null = null;

/**
 * Vrai une seule fois par ouverture de l'application installée : premier chargement dans cette
 * fenêtre (sessionStorage). Une sortie de veille, fenêtre ouverte, n'est pas une ouverture.
 */
export function isNewOpening(): boolean {
  if (cached !== null) return cached;
  cached = false;
  try {
    if (!isInstalled() || sessionStorage.getItem(OPENED)) return cached;
    sessionStorage.setItem(OPENED, "1");
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}
