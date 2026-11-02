import { readFileSync, existsSync } from "fs";
import { describe, expect, it } from "vitest";
import { parseSections, parseStories } from "../src/modules/backlog/parse";

describe("lecture des backlogs (forme « sections »)", () => {
  const md = `# Backlog

Intro.

## 1. Plan payant ✅

**Fait le 2026-10-06.**

## 4 bis. Coupure du service ✅ (v0.4.0, v0.5.0)

## 3. Sécurisation rapide

- ✅ en-têtes de sécurité
- reste : limitation

## 7. Récap -- code pret

## 8. Quota quotidien

- [x] calcul
- [ ] envoi

## 9. Tâches planifiées

- [x] a
- [x] b

## 39. Interface de supervision des garages — en attente

## 12. Ancienne fonction retiree

## 13. Idée

## 14. Contexte du projet ℹ️

Rien encore.
`;
  const items = parseSections(md);
  const by = (n: string) => items.find((i) => i.number === n)!;

  it("lit numéro, titre et statut", () => {
    expect(by("1")).toMatchObject({ title: "Plan payant", status: "done", key: "n1" });
    expect(by("4 bis").title).toBe("Coupure du service");
    expect(by("4 bis")).toMatchObject({ status: "done", versions: ["v0.4.0", "v0.5.0"], key: "n4bis" });
    expect(by("3").status).toBe("in_progress");
    expect(by("7").status).toBe("done");
    expect(by("8")).toMatchObject({ status: "in_progress", subtasks: [{ text: "calcul", done: true }, { text: "envoi", done: false }] });
    expect(by("9").status).toBe("done");
    expect(by("39").status).toBe("waiting");
    expect(by("12").status).toBe("dropped");
    expect(by("13").status).toBe("todo");
    expect(by("14").status).toBe("info");
  });
});

describe("lecture des backlogs (forme « stories »)", () => {
  const md = `## 4. Epics and user stories

### EPIC FND — Platform (P0)

**FND-01 — Open the app on mobile**
As a member...

**FND-02 — Separate family spaces** 
Text.

### EPIC IAM — Members (P0/P1)

**IAM-01 — Invite**
- [x] invitation envoyée
- [ ] relance

## 5. Notes
`;
  it("lit les stories, leur epic et leur priorité", () => {
    const items = parseStories(md);
    expect(items.map((i) => `${i.number}|${i.group}|${i.priority}|${i.status}`)).toEqual([
      "FND-01|EPIC FND — Platform|P0|todo",
      "FND-02|EPIC FND — Platform|P0|todo",
      "IAM-01|EPIC IAM — Members|P0/P1|in_progress",
    ]);
  });
});

// Vrais backlogs des dépôts, quand ils sont présents à côté (poste de développement).
const real = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : null);
describe("vrais backlogs", () => {
  it.each([
    ["/home/user/Mon-Garage-Auto/BACKLOG.md", "sections"],
    ["/home/user/procedia/BACKLOG.md", "sections"],
    ["/home/user/jmdev/agent-whatsapp-brvm/ROADMAP.md", "sections"],
    ["/home/user/my-family/docs/BACKLOG.md", "stories"],
  ])("%s se lit sans perte de chantier", (path, form) => {
    const md = real(path);
    if (!md) return;
    const items = form === "stories" ? parseStories(md) : parseSections(md);
    expect(items.length).toBeGreaterThan(5);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });
});
