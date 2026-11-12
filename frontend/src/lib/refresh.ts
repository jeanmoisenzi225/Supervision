// Actualisation demandée par l'utilisateur (glisser du haut vers le bas) : toutes les pages
// à chargement périodique se rechargent, et le serveur ignore ses mémoires tampons un court instant.
const EVENT = "supervision:refresh";
const FRESH_WINDOW_MS = 10_000;
let freshUntil = 0;

/** Vrai juste après une actualisation manuelle : les appels envoient `X-Refresh: 1`. */
export const isFreshRequested = () => Date.now() < freshUntil;

export function requestRefresh(): void {
  freshUntil = Date.now() + FRESH_WINDOW_MS;
  window.dispatchEvent(new Event(EVENT));
}

/** Écoute les actualisations manuelles ; renvoie la fonction qui arrête l'écoute. */
export function onRefreshRequested(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
