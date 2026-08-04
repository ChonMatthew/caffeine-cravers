import { describe, expect, it } from "vitest";

import { buildReceiptLines, RECEIPT_WIDTH, type ReceiptData } from "./receipt";

const ticket: ReceiptData = {
  dailyNumber: 12,
  recordNumber: 31,
  fulfilment: "Table 5",
  dateStr: "Sat 01 Aug  16:01",
  lines: [
    { quantity: 2, itemName: "Iced Latte", options: ["Large"], note: null },
    { quantity: 1, itemName: "Cappuccino", options: [], note: "no sugar" },
  ],
};

describe("buildReceiptLines", () => {
  it("keeps every line within the 32-column width", () => {
    for (const line of buildReceiptLines(ticket)) {
      expect(line.length).toBeLessThanOrEqual(RECEIPT_WIDTH);
    }
  });

  it("prints a make-ticket with no prices or payment", () => {
    const text = buildReceiptLines(ticket).join("\n");
    expect(text).not.toContain("RM");
    expect(text).not.toContain("TOTAL");
    expect(text).not.toContain("Change");
    expect(text).toMatchInlineSnapshot(`
      "Order #12                Ref #31
      Table 5
      Sat 01 Aug  16:01
      --------------------------------
      2x Iced Latte
         Large
      1x Cappuccino
         "no sugar"
      --------------------------------"
    `);
  });
});
