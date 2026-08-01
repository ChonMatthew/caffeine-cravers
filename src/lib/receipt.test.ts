import { describe, expect, it } from "vitest";

import { buildReceiptLines, RECEIPT_WIDTH, type ReceiptData } from "./receipt";

const base: Omit<ReceiptData, "payment"> = {
  stallName: "CAFFEINE CRAVERS",
  dailyNumber: 12,
  recordNumber: 31,
  fulfilment: "Table 5",
  dateStr: "Sat 01 Aug  16:01",
  lines: [
    { quantity: 2, itemName: "Iced Latte", options: ["Large"], note: null, unitPriceCents: 1000 },
    { quantity: 1, itemName: "Cappuccino", options: [], note: "no sugar", unitPriceCents: 700 },
  ],
  totalCents: 2700,
};

const unpaid: ReceiptData = { ...base, payment: { status: "unpaid" } };
const paid: ReceiptData = {
  ...base,
  payment: { status: "paid", tenderedCents: 3000, changeCents: 300 },
};

describe("buildReceiptLines", () => {
  it("keeps every line within the 32-column width", () => {
    for (const line of [...buildReceiptLines(unpaid), ...buildReceiptLines(paid)]) {
      expect(line.length).toBeLessThanOrEqual(RECEIPT_WIDTH);
    }
  });

  it("renders the UNPAID stamp before payment (no cash/change)", () => {
    const text = buildReceiptLines(unpaid).join("\n");
    expect(text).toContain("*** UNPAID ***");
    expect(text).not.toContain("Change");
    expect(text).toMatchInlineSnapshot(`
      "        CAFFEINE CRAVERS
      --------------------------------
      Order #12                Ref #31
      Table 5
      Sat 01 Aug  16:01
      --------------------------------
      2x Iced Latte           RM 20.00
         Large
      1x Cappuccino            RM 7.00
         "no sugar"
      --------------------------------
      TOTAL                   RM 27.00
      ================================
               *** UNPAID ***
      --------------------------------
                 Thank you!"
    `);
  });

  it("renders cash tendered + change once paid", () => {
    const text = buildReceiptLines(paid).join("\n");
    expect(text).toContain("Cash");
    expect(text).toContain("Change");
    expect(text).toMatchInlineSnapshot(`
      "        CAFFEINE CRAVERS
      --------------------------------
      Order #12                Ref #31
      Table 5
      Sat 01 Aug  16:01
      --------------------------------
      2x Iced Latte           RM 20.00
         Large
      1x Cappuccino            RM 7.00
         "no sugar"
      --------------------------------
      TOTAL                   RM 27.00
      ================================
      Cash                    RM 30.00
      Change                   RM 3.00
      --------------------------------
                 Thank you!"
    `);
  });
});
