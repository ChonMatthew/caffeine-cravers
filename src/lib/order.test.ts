import { describe, expect, it } from "vitest";

import {
  buildOrderLine,
  cartItemCount,
  cartReducer,
  cartTotalCents,
  computeChangeCents,
  formatFulfilment,
  makeLineKey,
  resolveUnitPrice,
  type CartState,
  type CatalogItemView,
  type SelectedOption,
} from "./order";

describe("formatFulfilment", () => {
  it("labels null as Takeaway, empty as Dine-in, and a value as Table N", () => {
    expect(formatFulfilment(null)).toBe("Takeaway");
    expect(formatFulfilment("")).toBe("Dine-in");
    expect(formatFulfilment("  ")).toBe("Dine-in");
    expect(formatFulfilment("5")).toBe("Table 5");
    expect(formatFulfilment(" A2 ")).toBe("Table A2");
  });
});

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

// A few named options to build selections from.
const sizeSmall: SelectedOption = {
  groupId: "size",
  optionId: "small",
  name: "Small",
  priceDeltaCents: 0,
};
const sizeLarge: SelectedOption = {
  groupId: "size",
  optionId: "large",
  name: "Large",
  priceDeltaCents: 200,
};
const tempIced: SelectedOption = {
  groupId: "temp",
  optionId: "iced",
  name: "Iced",
  priceDeltaCents: 100,
};

describe("makeLineKey", () => {
  it("is stable regardless of the order options were picked in", () => {
    const a = makeLineKey("latte", [sizeLarge, tempIced], "");
    const b = makeLineKey("latte", [tempIced, sizeLarge], "");
    expect(a).toBe(b);
  });

  it("differs when the note differs", () => {
    expect(makeLineKey("latte", [], "no sugar")).not.toBe(
      makeLineKey("latte", [], ""),
    );
  });

  it("differs when the option set differs", () => {
    expect(makeLineKey("latte", [sizeLarge], "")).not.toBe(
      makeLineKey("latte", [sizeSmall], ""),
    );
  });
});

function addAction(
  over: Partial<Parameters<typeof cartReducer>[1]> = {},
): Extract<Parameters<typeof cartReducer>[1], { type: "add" }> {
  return {
    type: "add",
    itemId: "latte",
    itemName: "Latte",
    baseCents: 800,
    options: [sizeLarge, tempIced],
    note: "",
    quantity: 1,
    ...over,
  } as Extract<Parameters<typeof cartReducer>[1], { type: "add" }>;
}

describe("cartReducer", () => {
  const empty: CartState = { lines: [], tableLabel: null };

  it("adds a priced line (base + deltas)", () => {
    const s = cartReducer(empty, addAction());
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].unitPriceCents).toBe(1100); // 800 + 200 + 100
    expect(s.lines[0].quantity).toBe(1);
  });

  it("merges an identical item+options+note into one line, summing quantity", () => {
    let s = cartReducer(empty, addAction({ quantity: 2 }));
    s = cartReducer(s, addAction({ quantity: 3 }));
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].quantity).toBe(5);
  });

  it("splits into a new line when options differ", () => {
    let s = cartReducer(empty, addAction({ options: [sizeLarge, tempIced] }));
    s = cartReducer(s, addAction({ options: [sizeSmall, tempIced] }));
    expect(s.lines).toHaveLength(2);
  });

  it("splits into a new line when the note differs", () => {
    let s = cartReducer(empty, addAction({ note: "no sugar" }));
    s = cartReducer(s, addAction({ note: "" }));
    expect(s.lines).toHaveLength(2);
  });

  it("inc/dec adjusts quantity; dec at 1 removes the line", () => {
    let s = cartReducer(empty, addAction());
    const key = s.lines[0].key;
    s = cartReducer(s, { type: "inc", key });
    expect(s.lines[0].quantity).toBe(2);
    s = cartReducer(s, { type: "dec", key });
    s = cartReducer(s, { type: "dec", key });
    expect(s.lines).toHaveLength(0);
  });

  it("remove drops a line; clear empties the cart", () => {
    let s = cartReducer(empty, addAction());
    s = cartReducer(s, addAction({ options: [sizeSmall] }));
    const key = s.lines[0].key;
    s = cartReducer(s, { type: "remove", key });
    expect(s.lines).toHaveLength(1);
    s = cartReducer(s, { type: "clear" });
    expect(s.lines).toHaveLength(0);
  });

  it("carries the fulfilment (tableLabel) through line edits, resets on clear", () => {
    let s = cartReducer(empty, { type: "setTable", tableLabel: "5" });
    expect(s.tableLabel).toBe("5");
    s = cartReducer(s, addAction()); // adding an item keeps the table
    expect(s.tableLabel).toBe("5");
    s = cartReducer(s, { type: "clear" }); // clear resets to takeaway
    expect(s.tableLabel).toBeNull();
    expect(s.lines).toHaveLength(0);
  });

  it("computes totals and item counts", () => {
    let s = cartReducer(empty, addAction({ quantity: 2 })); // 1100 * 2
    s = cartReducer(s, addAction({ options: [], note: "plain", quantity: 1 })); // 800
    expect(cartTotalCents(s)).toBe(2200 + 800);
    expect(cartItemCount(s)).toBe(3);
  });
});

describe("computeChangeCents", () => {
  it("returns change when tendered exceeds the total (RM20 for RM11 = RM9)", () => {
    expect(computeChangeCents(1100, 2000)).toBe(900);
  });

  it("returns zero change on an exact tender", () => {
    expect(computeChangeCents(1100, 1100)).toBe(0);
  });

  it("rejects a tender below the total", () => {
    expect(() => computeChangeCents(1100, 1000)).toThrow(/less than the total/);
  });

  it("rejects a non-integer or negative tender", () => {
    expect(() => computeChangeCents(1100, 11.5)).toThrow(/valid cash amount/);
    expect(() => computeChangeCents(1100, -1)).toThrow(/valid cash amount/);
  });
});

// A catalog Latte with Size (required) and Temp (required, one inactive option).
const latte: CatalogItemView = {
  id: "latte",
  name: "Latte",
  priceCents: 800,
  isActive: true,
  optionGroups: [
    {
      id: "size",
      name: "Size",
      required: true,
      options: [
        { id: "small", name: "Small", priceDeltaCents: 0, isActive: true },
        { id: "large", name: "Large", priceDeltaCents: 200, isActive: true },
      ],
    },
    {
      id: "temp",
      name: "Temp",
      required: true,
      options: [
        { id: "hot", name: "Hot", priceDeltaCents: 0, isActive: true },
        { id: "iced", name: "Iced", priceDeltaCents: 100, isActive: true },
        { id: "gone", name: "Gone", priceDeltaCents: 500, isActive: false },
      ],
    },
  ],
};

describe("buildOrderLine (server-side re-price)", () => {
  it("re-prices from the catalog and snapshots chosen options", () => {
    const line = buildOrderLine(latte, {
      itemId: "latte",
      optionIds: ["large", "iced"],
      note: " no sugar ",
      quantity: 2,
    });
    expect(line.unitPriceCents).toBe(1100); // recomputed, not trusted
    expect(line.quantity).toBe(2);
    expect(line.note).toBe("no sugar"); // trimmed
    expect(line.options).toEqual([
      { name: "Large", priceDeltaCents: 200 },
      { name: "Iced", priceDeltaCents: 100 },
    ]);
  });

  it("normalises an empty note to null", () => {
    const line = buildOrderLine(latte, {
      itemId: "latte",
      optionIds: ["small", "hot"],
      note: "   ",
      quantity: 1,
    });
    expect(line.note).toBeNull();
  });

  it("rejects a missing required group", () => {
    expect(() =>
      buildOrderLine(latte, {
        itemId: "latte",
        optionIds: ["large"], // no Temp chosen
        note: "",
        quantity: 1,
      }),
    ).toThrow(/Temp/);
  });

  it("rejects two options from one single-select group", () => {
    expect(() =>
      buildOrderLine(latte, {
        itemId: "latte",
        optionIds: ["small", "large", "hot"],
        note: "",
        quantity: 1,
      }),
    ).toThrow(/only one Size/);
  });

  it("rejects an inactive option", () => {
    expect(() =>
      buildOrderLine(latte, {
        itemId: "latte",
        optionIds: ["small", "gone"],
        note: "",
        quantity: 1,
      }),
    ).toThrow(/Temp/); // 'gone' is inactive -> Temp reads as unchosen
  });

  it("rejects an unknown option id", () => {
    expect(() =>
      buildOrderLine(latte, {
        itemId: "latte",
        optionIds: ["small", "hot", "espresso-shot"],
        note: "",
        quantity: 1,
      }),
    ).toThrow(/Unknown option/);
  });

  it("rejects a bad quantity", () => {
    expect(() =>
      buildOrderLine(latte, {
        itemId: "latte",
        optionIds: ["small", "hot"],
        note: "",
        quantity: 0,
      }),
    ).toThrow(/quantity/);
  });

  it("rejects an inactive item", () => {
    expect(() =>
      buildOrderLine(
        { ...latte, isActive: false },
        { itemId: "latte", optionIds: ["small", "hot"], note: "", quantity: 1 },
      ),
    ).toThrow(/not available/);
  });
});
