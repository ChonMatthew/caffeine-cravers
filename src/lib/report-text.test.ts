import { describe, expect, it } from "vitest";

import { buildReportText, type ReportTextInput } from "@/lib/report-text";

const base: ReportTextInput = {
  title: "Mon 04 Aug 2026",
  generatedAt: "05 Aug 2026, 21:15 (Asia/Kuala_Lumpur)",
  isAll: false,
  summary: {
    paidOrders: 7,
    revenueCents: 6700,
    itemsSold: 8,
    dineInCount: 2,
    takeawayCount: 5,
    tenderedCents: 11500,
    changeCents: 4800,
  },
  hourly: [
    { hour: 16, orders: 6, revenueCents: 6100 },
    { hour: 20, orders: 1, revenueCents: 600 },
  ],
  breakdown: [
    { itemName: "Americano", variation: "", quantity: 2, revenueCents: 1000 },
    { itemName: "Iced Latte", variation: "Large", quantity: 1, revenueCents: 1100 },
  ],
  orders: [
    { dailyNumber: 1, time: "16:04", fulfilment: "Takeaway", itemCount: 1, totalCents: 500 },
    { dailyNumber: 2, time: "16:11", fulfilment: "Table 3", itemCount: 2, totalCents: 1200 },
  ],
};

describe("buildReportText", () => {
  it("renders every section for a single day", () => {
    const text = buildReportText(base);
    expect(text).toContain("CAFFEINE CRAVERS — SALES REPORT");
    expect(text).toContain("Mon 04 Aug 2026");
    expect(text).toContain("Revenue");
    expect(text).toContain("RM 67.00"); // revenue
    expect(text).toContain("Avg ticket");
    expect(text).toContain("RM 9.57"); // 6700 / 7 rounded
    expect(text).toContain("Expected in drawer");
    expect(text).toContain("- RM 48.00"); // change given
    expect(text).toContain("BY HOUR");
    expect(text).toContain("16:00");
    expect(text).toContain("2x Americano");
    expect(text).toContain("1x Iced Latte · Large"); // variation joined
    expect(text).toContain("ORDERS (2)");
    expect(text).toContain("#1  16:04  Takeaway  1 item");
    expect(text).toContain("#2  16:11  Table 3  2 items");
  });

  it("labels the hourly section and omits the order log for all-time", () => {
    const text = buildReportText({ ...base, isAll: true, title: "All-time", orders: [] });
    expect(text).toContain("BY HOUR (all days)");
    expect(text).not.toContain("ORDERS (");
  });

  it("handles an empty period without throwing", () => {
    const text = buildReportText({
      ...base,
      summary: {
        paidOrders: 0,
        revenueCents: 0,
        itemsSold: 0,
        dineInCount: 0,
        takeawayCount: 0,
        tenderedCents: 0,
        changeCents: 0,
      },
      hourly: [],
      breakdown: [],
      orders: [],
    });
    expect(text).toContain("Avg ticket");
    expect(text).toContain("RM 0.00");
    expect(text).toContain("(no sales)");
    expect(text).toContain("(no paid orders)");
  });
});
