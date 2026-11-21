import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou (v0.49.3) : chaque écran de la Supervision qui charge des données doit écouter le geste
 * « glisser pour actualiser » (via `usePolling` ou `onRefreshRequested`). Un nouveau fichier qui appelle l'API
 * sans l'écouter fait échouer ce test, sauf s'il est justifié dans la liste ci-dessous.
 */
const SRC = path.resolve(__dirname, "../../frontend/src");
const EXEMPT: Record<string, string> = {
  "lib/api.ts": "client HTTP lui-même",
  "pages/Login.tsx": "connexion : aucune donnée à rafraîchir",
  "pages/SignPage.tsx": "page publique de signature, hors de l'application connectée",
  "components/DiagnosticPanel.tsx": "actions déclenchées par un bouton, aucun chargement",
  "components/PauseControls.tsx": "actions déclenchées par un bouton, aucun chargement",
  "components/CommandPalette.tsx": "recharge la liste à chaque ouverture",
};

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

describe("actualisation par glissement", () => {
  const callers = files(SRC).map((f) => ({ rel: path.relative(SRC, f).replaceAll("\\", "/"), src: fs.readFileSync(f, "utf8") })).filter((f) => /\bapi(Blob)?[<(]/.test(f.src));

  it("trouve bien les écrans à vérifier", () => {
    expect(callers.length).toBeGreaterThan(15);
  });
  it("chaque écran qui charge des données écoute le geste", () => {
    const missing = callers.filter((f) => !(f.rel in EXEMPT) && !/usePolling\(|onRefreshRequested\(/.test(f.src)).map((f) => f.rel);
    expect(missing).toEqual([]);
  });
  it("la liste des exceptions ne contient pas de fichier disparu", () => {
    for (const rel of Object.keys(EXEMPT)) expect(fs.existsSync(path.join(SRC, rel)), rel).toBe(true);
  });
});
