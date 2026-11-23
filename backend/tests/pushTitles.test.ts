import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Les notifications n'affichent plus d'émoji dans leur titre : l'icône (`kind`) porte l'information visuelle. */
const SRC = path.resolve(__dirname, "../src/modules");
const FILES = ["alerts/alerts.service.ts", "push/push.routes.ts", "billing/signature.routes.ts"];

describe("titres de notification", () => {
  for (const f of FILES) {
    it(`${f} : aucun émoji dans les titres`, () => {
      const lines = fs.readFileSync(path.join(SRC, f), "utf8").split("\n").filter((l) => /\btitle\s*:/.test(l) || /sendPushToAll\(/.test(l));
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) expect(/\p{Extended_Pictographic}/u.test(l), l.trim()).toBe(false);
    });
  }
  it("chaque icône de notification existe", () => {
    const worker = fs.readFileSync(path.resolve(__dirname, "../../frontend/public/push-worker.js"), "utf8");
    for (const f of ["critique", "avertissement", "ok", "signature"]) {
      expect(worker).toContain(`/notif/${f}.png`);
      expect(fs.existsSync(path.resolve(__dirname, `../../frontend/public/notif/${f}.png`)), f).toBe(true);
    }
  });
});
