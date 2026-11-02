import { createHmac } from "crypto";

/**
 * Protocole d'administration Supervision → applis (voir docs/integration.md).
 *
 * - Clé : `<APPLI>_ADMIN_TOKEN` si défini, sinon dérivée du jeton d'envoi des
 *   journaux déjà partagé (HMAC-SHA256(jetonEnvoi, "supervision-admin")) :
 *   aucune variable de plus à saisir.
 * - Chaque appel est signé : HMAC-SHA256(clé, `${horodatage}.${méthode}.${chemin}.${corps}`),
 *   en-têtes `X-Supervision-Timestamp` (millisecondes) et `X-Supervision-Signature` (hex).
 *   `chemin` est relatif à `/supervision` (ex. `/actions/notification-test`),
 *   `corps` est le JSON envoyé (vide pour un GET). L'appli refuse une
 *   signature fausse ou un horodatage à plus de 5 minutes : un ordre
 *   intercepté ne peut être ni modifié ni rejoué plus tard.
 */
export function deriveAdminKey(ingestToken: string): string {
  return ingestToken ? createHmac("sha256", ingestToken).update("supervision-admin").digest("hex") : "";
}

export function signAdminRequest(key: string, timestamp: number, method: string, relPath: string, body: string): string {
  return createHmac("sha256", key).update(`${timestamp}.${method.toUpperCase()}.${relPath}.${body}`).digest("hex");
}
