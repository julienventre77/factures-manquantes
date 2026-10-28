import { describe, expect, it } from "vitest";
import { initials, normalizeSupplier } from "./supplier";

describe("normalizeSupplier", () => {
  it("groups CB AMAZON and AMAZON PAYMENTS as Amazon", () => {
    expect(normalizeSupplier("CB AMAZON 12/10")).toBe("Amazon");
    expect(normalizeSupplier("AMAZON PAYMENTS EUROPE")).toBe("Amazon");
    expect(normalizeSupplier("AMZN MKTP FR*1A2B3")).toBe("Amazon");
  });
  it("strips bank noise for unknown suppliers", () => {
    expect(normalizeSupplier("PRLV SEPA BOULANGERIE DUPONT 123456")).toBe("Boulangerie Dupont");
  });
});

describe("initials", () => {
  it("takes the first letters of the first two significant words", () => {
    expect(initials("Leroy Merlin")).toBe("LM");
    expect(initials("SARL Martin Rénovation")).toBe("MR");
    expect(initials("Votre cabinet")).toBe("VC");
  });
  it("takes two letters of a single word", () => {
    expect(initials("Amazon")).toBe("AM");
    expect(initials("OVHcloud")).toBe("OV");
  });
  it("never returns an empty monogram", () => {
    expect(initials("")).toBe("?");
  });
});
