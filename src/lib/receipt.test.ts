import { describe, expect, it } from "vitest";

import {
  buildCustomerReceiptLines,
  buildReceiptLines,
  buildStationTicketLines,
  RECEIPT_WIDTH,
  splitReceiptByStation,
  type CustomerReceiptData,
  type ReceiptData,
} from "./receipt";

const ticket: ReceiptData = {
  dailyNumber: 12,
  refLabel: "BT-31",
  fulfilment: "Table 5",
  dateStr: "Sat 01 Aug  16:01",
  lines: [
    {
      quantity: 2,
      itemName: "Iced Latte",
      options: ["Large"],
      note: null,
      station: "drink",
    },
    {
      quantity: 1,
      itemName: "Cappuccino",
      options: [],
      note: "no sugar",
      station: "drink",
    },
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
      "Order #12             Ref #BT-31
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

describe("splitReceiptByStation", () => {
  const mixed: ReceiptData = {
    ...ticket,
    lines: [
      ...ticket.lines,
      {
        quantity: 1,
        itemName: "Chicken Curry Puff",
        options: [],
        note: null,
        station: "food",
      },
    ],
  };

  it("groups lines by station and keeps the shared header", () => {
    const split = splitReceiptByStation(mixed);
    expect(split.drink?.lines).toHaveLength(2);
    expect(split.food?.lines).toHaveLength(1);
    expect(split.food?.dailyNumber).toBe(mixed.dailyNumber);
  });

  it("omits a station with no matching lines — no blank chit", () => {
    const split = splitReceiptByStation(ticket); // drink-only
    expect(split.drink).toBeDefined();
    expect(split.food).toBeUndefined();
  });
});

describe("buildStationTicketLines", () => {
  it("heads the ticket with the station label", () => {
    const lines = buildStationTicketLines(ticket, "drink");
    expect(lines[0]).toBe("DRINKS TICKET");
    expect(lines.slice(1)).toEqual(buildReceiptLines(ticket));
  });
});

describe("buildCustomerReceiptLines", () => {
  const customerTicket: CustomerReceiptData = {
    shopName: "Bukit Tinggi",
    dailyNumber: 12,
    refLabel: "BT-31",
    fulfilment: "Table 5",
    dateStr: "Sat 01 Aug  16:01",
    lines: [
      { quantity: 2, itemName: "Iced Latte", options: ["Large"], unitPriceCents: 1000 },
      { quantity: 1, itemName: "Cappuccino", options: [], unitPriceCents: 700 },
    ],
    totalCents: 2700,
    cashTenderedCents: 3000,
    changeCents: 300,
  };

  it("keeps every line within the 32-column width", () => {
    for (const line of buildCustomerReceiptLines(customerTicket)) {
      expect(line.length).toBeLessThanOrEqual(RECEIPT_WIDTH);
    }
  });

  it("keeps the longest realistic header within 32 columns", () => {
    const lines = buildCustomerReceiptLines({
      ...customerTicket,
      dailyNumber: 999,
      refLabel: "BT-99999",
    });
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(RECEIPT_WIDTH);
    }
  });

  it("prices every line and totals the payment — unlike the barista ticket", () => {
    expect(buildCustomerReceiptLines(customerTicket).join("\n"))
      .toMatchInlineSnapshot(`
        "          BUKIT TINGGI
        --------------------------------
        Order #12             Ref #BT-31
        Table 5
        Sat 01 Aug  16:01
        --------------------------------
        2x Iced Latte           RM 20.00
           Large
        1x Cappuccino            RM 7.00
        --------------------------------
        TOTAL                   RM 27.00
        Cash                    RM 30.00
        Change                   RM 3.00
        --------------------------------
        Thank you!"
      `);
  });
});
