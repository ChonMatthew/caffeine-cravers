// Pure receipt layout — order data in, an array of 32-column ASCII lines out.
// No React, no bytes, no I/O, so it snapshot-tests cleanly (read the snapshot to
// see the exact receipt BEFORE anything prints). escpos.ts turns these lines
// into printer bytes; printer.ts pushes them over BLE.

import { formatCents } from "@/lib/money";

// 58mm thermal paper at Font A fits 32 characters per line.
export const RECEIPT_WIDTH = 32;

export type ReceiptLine = {
  quantity: number;
  itemName: string;
  options: string[]; // e.g. ["Large"] — the chosen variation names
  note: string | null;
  unitPriceCents: number;
};

export type ReceiptData = {
  stallName: string;
  dailyNumber: number; // "Order #12 today"
  recordNumber: number; // permanent order_seq
  fulfilment: string; // already formatted: "Takeaway" | "Dine-in" | "Table 5"
  dateStr: string; // pre-formatted in the stall's local timezone
  lines: ReceiptLine[];
  totalCents: number;
  // Two footer states: printed before payment (UNPAID stamp) vs after (cash/change).
  payment:
    | { status: "unpaid" }
    | { status: "paid"; tenderedCents: number; changeCents: number };
};

const W = RECEIPT_WIDTH;

/** "left..........right" padded to the full width; left truncates if needed. */
function row(left: string, right: string): string {
  const l = left.slice(0, Math.max(0, W - right.length - 1));
  const gap = Math.max(1, W - l.length - right.length);
  return l + " ".repeat(gap) + right;
}

function center(s: string): string {
  const t = s.slice(0, W);
  const left = Math.max(0, Math.floor((W - t.length) / 2));
  return " ".repeat(left) + t;
}

const divider = "-".repeat(W);
const rule = "=".repeat(W);

/**
 * Build the receipt as 32-col lines. ASCII only (the thermal printer speaks a
 * bare ASCII subset). Money always goes through lib/money so it matches the app.
 */
export function buildReceiptLines(data: ReceiptData): string[] {
  const out: string[] = [];

  out.push(center(data.stallName));
  out.push(divider);
  out.push(row(`Order #${data.dailyNumber}`, `Ref #${data.recordNumber}`));
  out.push(data.fulfilment);
  out.push(data.dateStr);
  out.push(divider);

  for (const line of data.lines) {
    out.push(
      row(
        `${line.quantity}x ${line.itemName}`,
        formatCents(line.unitPriceCents * line.quantity),
      ),
    );
    for (const opt of line.options) out.push(`   ${opt}`);
    if (line.note) out.push(`   "${line.note}"`);
  }

  out.push(divider);
  out.push(row("TOTAL", formatCents(data.totalCents)));
  out.push(rule);

  if (data.payment.status === "unpaid") {
    out.push(center("*** UNPAID ***"));
  } else {
    out.push(row("Cash", formatCents(data.payment.tenderedCents)));
    out.push(row("Change", formatCents(data.payment.changeCents)));
  }

  out.push(divider);
  out.push(center("Thank you!"));
  return out;
}
