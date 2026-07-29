import { describe, expect, it } from "vitest";

import { centsToInput, formatCents, parseAmountToCents } from "./money";

describe("parseAmountToCents", () => {
  it("parses whole and decimal amounts", () => {
    expect(parseAmountToCents("7")).toBe(700);
    expect(parseAmountToCents("7.5")).toBe(750);
    expect(parseAmountToCents("7.50")).toBe(750);
    expect(parseAmountToCents("07.50")).toBe(750);
    expect(parseAmountToCents("0")).toBe(0);
    expect(parseAmountToCents("0.05")).toBe(5);
  });

  it("does not suffer float rounding (the parseFloat*100 trap)", () => {
    expect(parseAmountToCents("4.50")).toBe(450); // parseFloat("4.50")*100 = 449.99…
    expect(parseAmountToCents("19.99")).toBe(1999);
  });

  it("rejects invalid input", () => {
    expect(() => parseAmountToCents("7.555")).toThrow();
    expect(() => parseAmountToCents("abc")).toThrow();
    expect(() => parseAmountToCents("")).toThrow();
    expect(() => parseAmountToCents("-5")).toThrow();
    expect(() => parseAmountToCents("7.")).toThrow();
  });
});

describe("formatCents", () => {
  it("formats cents as MYR currency", () => {
    expect(formatCents(700)).toBe("RM 7.00");
    expect(formatCents(750)).toBe("RM 7.50");
    expect(formatCents(0)).toBe("RM 0.00");
    expect(formatCents(1999)).toBe("RM 19.99");
  });
});

describe("centsToInput", () => {
  it("renders cents as an editable amount string", () => {
    expect(centsToInput(700)).toBe("7.00");
    expect(centsToInput(750)).toBe("7.50");
    expect(centsToInput(5)).toBe("0.05");
    expect(centsToInput(0)).toBe("0.00");
  });

  it("round-trips with parseAmountToCents", () => {
    for (const cents of [0, 5, 700, 750, 1999, 123456]) {
      expect(parseAmountToCents(centsToInput(cents))).toBe(cents);
    }
  });
});
