import { describe, expect, it } from "vitest";
import { cleanLine, levelOf } from "../src/modules/renderLogs/renderLogs.service";

describe("Journaux Render (v0.30.0)", () => {
  it("retire les codes de couleur et les espaces de fin", () => {
    expect(cleanLine("\u001b[34m\u001b[1m==>\u001b(B\u001b[m Running  ")).toBe("==> Running");
  });
  it("déduit le niveau de la ligne", () => {
    expect(levelOf("[mémoire] import : début : 135 Mo")).toBe("info");
    expect(levelOf("[mémoire] import : fin : 420 Mo — ALERTE proche de la limite de 512 Mo")).toBe("warn");
    expect(levelOf("[document] conservation impossible : erreur")).toBe("error");
    expect(levelOf("FATAL: JavaScript heap out of memory")).toBe("fatal");
    expect(levelOf("API Procedia à l'écoute sur le port 4000")).toBe("info");
    expect(levelOf("tout va bien", { level: "error" })).toBe("error");
  });
});
