import { describe, expect, it } from "vitest";

import { resolveUnitPrice, type SelectedOption } from "./order";

// Small helper so the cases below read as "just the deltas that matter".
function opt(priceDeltaCents: number): SelectedOption {
  return { groupId: "g", optionId: "o", name: "x", priceDeltaCents };
}

describe("resolveUnitPrice", () => {
  it("returns the base price when nothing is selected", () => {
    expect(resolveUnitPrice(800, [])).toBe(800);
  });

  it("adds every chosen option's delta (the Latte/Large/Iced example)", () => {
    // base 8.00 + Large 2.00 + Iced 1.00 = 11.00
    expect(resolveUnitPrice(800, [opt(200), opt(100)])).toBe(1100);
  });

  it("treats zero-delta options as free (e.g. Small +0, Hot +0)", () => {
    expect(resolveUnitPrice(800, [opt(0), opt(0)])).toBe(800);
  });

  it("supports negative deltas (a discount option) but never goes below 0", () => {
    expect(resolveUnitPrice(800, [opt(-200)])).toBe(600);
    expect(resolveUnitPrice(800, [opt(-2000)])).toBe(0); // clamped, not -1200
  });
});
