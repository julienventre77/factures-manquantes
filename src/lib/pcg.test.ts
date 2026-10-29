import { describe, expect, it } from "vitest";
import { COMPTES_ACHAT, compteAchatValide, comptePcg, libellePcg } from "./pcg";

describe("plan de comptes ANC 2026", () => {
  it("reprend les intitulés du plan", () => {
    expect(libellePcg("401")).toBe("Fournisseurs");
    expect(libellePcg("44566")).toBe("TVA sur autres biens et services");
    expect(libellePcg("44562")).toBe("TVA sur immobilisations");
    expect(libellePcg("486")).toBe("Charges constatées d'avance");
    expect(libellePcg("626")).toBe("Frais postaux et de télécommunications");
  });
  it("rattache une subdivision au compte qu'elle subdivise (art. 1131-1)", () => {
    expect(comptePcg("62261")).toEqual({ numero: "6226", libelle: "Honoraires" });
    expect(libellePcg("62261")).toBe("Honoraires (subdivision du 6226)");
    expect(comptePcg("999")).toBeNull();
  });
  it("n'accepte en ligne d'achat que les immobilisations, charges et 486 du plan", () => {
    expect(compteAchatValide("2183")).toBe(true);
    expect(compteAchatValide("60632")).toBe(true);
    expect(compteAchatValide("486")).toBe(true);
    expect(compteAchatValide("401")).toBe(false);
    expect(compteAchatValide("44566")).toBe(false);
    expect(compteAchatValide("6037")).toBe(false); // variation des stocks
    expect(compteAchatValide("681")).toBe(false);
    expect(compteAchatValide("6262")).toBe(true); // subdivision de 626
  });
  it("la liste proposée à Claude ne contient ni 486 ni comptes de tiers", () => {
    const n = COMPTES_ACHAT.map((c) => c.numero);
    expect(n).toContain("6226");
    expect(n).toContain("2183");
    expect(n.some((x) => x.startsWith("486") || x.startsWith("4"))).toBe(false);
  });
});
