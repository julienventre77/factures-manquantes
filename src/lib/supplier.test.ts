import { describe, expect, it } from "vitest";
import { normalizeSupplier } from "./supplier";

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
