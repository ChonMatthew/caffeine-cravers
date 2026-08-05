// Pure text renderer for the daily (or all-time) sales report. Kept free of
// React / dates / tz / I/O so it unit-tests cleanly — the route handler does the
// DB reads and pre-formats every date/time/label into strings before calling in.
// Plain text now; a PDF renderer can layer on the same data shape later.

import type { HourlyRow, ReportSummary } from "@/lib/dal";
import { formatCents } from "@/lib/money";

const WIDTH = 46;

/** One already-shaped order line for the ORDERS section. */
export type ReportTextOrder = {
  dailyNumber: number;
  time: string; // "16:04", stall-local, formatted by the caller
  fulfilment: string; // "Takeaway" / "Table 3"
  itemCount: number;
  totalCents: number;
};

/** One already-shaped best-seller line (variation pre-joined by the caller). */
export type ReportTextItem = {
  itemName: string;
  variation: string; // "" when the item has no options
  quantity: number;
  revenueCents: number;
};

export type ReportTextInput = {
  title: string; // "Mon 04 Aug 2026" or "All-time"
  generatedAt: string; // caller-formatted timestamp, incl. timezone note
  isAll: boolean; // all-time omits the per-order log
  summary: ReportSummary;
  hourly: HourlyRow[];
  breakdown: ReportTextItem[];
  orders: ReportTextOrder[]; // empty for all-time
};

function rule(ch = "="): string {
  return ch.repeat(WIDTH);
}

/** "  Label            value" — value flush-right to WIDTH (≥1 gap if it won't fit). */
function row(label: string, value: string): string {
  const left = `  ${label}`;
  const gap = Math.max(1, WIDTH - left.length - value.length);
  return left + " ".repeat(gap) + value;
}

export function buildReportText(d: ReportTextInput): string {
  const out: string[] = [];
  const avgCents = d.summary.paidOrders
    ? Math.round(d.summary.revenueCents / d.summary.paidOrders)
    : 0;

  out.push("CAFFEINE CRAVERS — SALES REPORT");
  out.push(d.title);
  out.push(`Generated ${d.generatedAt}`);
  out.push(rule());
  out.push("");

  out.push("SUMMARY");
  out.push(row("Revenue", formatCents(d.summary.revenueCents)));
  out.push(row("Paid orders", String(d.summary.paidOrders)));
  out.push(row("Avg ticket", formatCents(avgCents)));
  out.push(row("Items sold", String(d.summary.itemsSold)));
  out.push("");

  out.push("CASH DRAWER");
  out.push(row("Expected in drawer", formatCents(d.summary.revenueCents)));
  out.push(row("Cash tendered", formatCents(d.summary.tenderedCents)));
  out.push(row("Change given", `- ${formatCents(d.summary.changeCents)}`));
  out.push("");

  out.push("FULFILMENT");
  out.push(row("Dine-in", String(d.summary.dineInCount)));
  out.push(row("Takeaway", String(d.summary.takeawayCount)));
  out.push("");

  out.push(d.isAll ? "BY HOUR (all days)" : "BY HOUR");
  if (d.hourly.length === 0) {
    out.push("  (no sales)");
  } else {
    for (const h of d.hourly) {
      const hr = `${String(h.hour).padStart(2, "0")}:00`;
      const cnt = `${h.orders} order${h.orders === 1 ? "" : "s"}`;
      out.push(row(`${hr}  ${cnt}`, formatCents(h.revenueCents)));
    }
  }
  out.push("");

  out.push("BEST SELLERS");
  if (d.breakdown.length === 0) {
    out.push("  (no sales)");
  } else {
    for (const b of d.breakdown) {
      const name = b.variation ? `${b.itemName} · ${b.variation}` : b.itemName;
      out.push(row(`${b.quantity}x ${name}`, formatCents(b.revenueCents)));
    }
  }
  out.push("");

  // Per-order log — a specific day only (all-time would be the whole history).
  if (!d.isAll) {
    out.push(`ORDERS (${d.orders.length})`);
    if (d.orders.length === 0) {
      out.push("  (no paid orders)");
    } else {
      for (const o of d.orders) {
        const items = `${o.itemCount} item${o.itemCount === 1 ? "" : "s"}`;
        const left = `#${o.dailyNumber}  ${o.time}  ${o.fulfilment}  ${items}`;
        out.push(row(left, formatCents(o.totalCents)));
      }
    }
    out.push("");
  }

  out.push(rule());
  out.push("End of report");
  return out.join("\n") + "\n";
}
