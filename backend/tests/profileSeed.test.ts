import { describe, expect, it } from "vitest";
import { mergeSeed } from "../src/modules/billing/profile-seed";

describe("profil prestataire : remplissage initial", () => {
  it("complète les champs vides", () => {
    const r = mergeSeed({ brandName: "NJMDev" }, { legalName: " Nom Test ", businessAddress: "1 rue X", legalForm: "personne_physique" });
    expect(r.merged).toMatchObject({ brandName: "NJMDev", legalName: "Nom Test", businessAddress: "1 rue X", legalForm: "personne_physique" });
    expect(r.changed.sort()).toEqual(["businessAddress", "legalForm", "legalName"]);
  });
  it("n'écrase jamais une valeur déjà saisie et ignore les champs non autorisés", () => {
    const r = mergeSeed({ legalName: "Déjà saisi", rccm: "" }, { legalName: "Autre", rccm: "123", paymentDetails: "IBAN" });
    expect(r.merged.legalName).toBe("Déjà saisi");
    expect(r.merged.rccm).toBe("");
    expect(r.merged.paymentDetails).toBeUndefined();
    expect(r.changed).toEqual([]);
  });
});
