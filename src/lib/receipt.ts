// Pure barista-ticket layout — order data in, an array of 32-column ASCII lines
// out. This is NOT a customer receipt: no stall banner, no prices, no payment —
// just what the barista needs to make the order. No React, no bytes, no I/O, so
// it snapshot-tests cleanly (read the snapshot to see the exact ticket BEFORE
// anything prints). escpos.ts turns these lines into printer bytes; printer.ts
// pushes them over BLE.

import { formatCents } from "@/lib/money";
import type { Station } from "@/lib/order";

// 58mm thermal paper at Font A fits 32 characters per line.
export const RECEIPT_WIDTH = 32;

export type ReceiptLine = {
  quantity: number;
  itemName: string;
  options: string[]; // e.g. ["Large"] — the chosen variation names
  note: string | null;
  station: Station;
};

export type ReceiptData = {
  dailyNumber: number; // "Order #12 today"
  refLabel: string; // permanent per-shop Ref #, prefix included: "BT-31"
  fulfilment: string; // already formatted: "Takeaway" | "Dine-in" | "Table 5"
  dateStr: string; // pre-formatted in the stall's local timezone
  lines: ReceiptLine[];
};

const W = RECEIPT_WIDTH;

/** "left..........right" padded to the full width; left truncates if needed. */
function row(left: string, right: string): string {
  const l = left.slice(0, Math.max(0, W - right.length - 1));
  const gap = Math.max(1, W - l.length - right.length);
  return l + " ".repeat(gap) + right;
}

const divider = "-".repeat(W);

/**
 * Build the barista ticket as 32-col lines. ASCII only (the thermal printer
 * speaks a bare ASCII subset). No prices and no payment — a ticket is a make
 * order, not a bill.
 */
export function buildReceiptLines(data: ReceiptData): string[] {
  const out: string[] = [];

  out.push(row(`Order #${data.dailyNumber}`, `Ref #${data.refLabel}`));
  out.push(data.fulfilment);
  out.push(data.dateStr);
  out.push(divider);

  for (const line of data.lines) {
    out.push(`${line.quantity}x ${line.itemName}`);
    for (const opt of line.options) out.push(`   ${opt}`);
    if (line.note) out.push(`   "${line.note}"`);
  }

  out.push(divider);
  return out;
}

// ============================================================================
// Station split — one order can carry both food and drink lines, but they
// print as two separate chits (today both may land on the same physical
// printer; lib/printer-context.tsx is what decides where each job goes).
// ============================================================================

const STATION_LABEL: Record<Station, string> = {
  food: "FOOD TICKET",
  drink: "DRINKS TICKET",
};

/**
 * Split a ticket into per-station tickets, each carrying only that station's
 * lines. A station with no matching lines is omitted — no blank chit goes to
 * a printer for a station nothing was ordered from.
 */
export function splitReceiptByStation(
  data: ReceiptData,
): Partial<Record<Station, ReceiptData>> {
  const out: Partial<Record<Station, ReceiptData>> = {};
  for (const station of ["food", "drink"] as const) {
    const lines = data.lines.filter((l) => l.station === station);
    if (lines.length > 0) out[station] = { ...data, lines };
  }
  return out;
}

/** A station ticket's lines, headed so two chits from one printer stay apart. */
export function buildStationTicketLines(
  data: ReceiptData,
  station: Station,
): string[] {
  return [STATION_LABEL[station], ...buildReceiptLines(data)];
}

// ============================================================================
// Customer copy — deliberately a SEPARATE type from ReceiptData, not an
// extension of it: the barista ticket's no-prices/no-payment shape is a
// guarantee callers rely on, and giving it an optional price field would
// weaken that to a convention instead of a type. This one prints only when
// the operator explicitly asks (never automatic, never station-split — it's
// one copy of the whole order for the customer, not the kitchen).
// ============================================================================

export type CustomerReceiptLine = {
  quantity: number;
  itemName: string;
  options: string[];
  unitPriceCents: number;
};

export type CustomerReceiptData = {
  shopName: string; // banner line: which shop sold it ("Bukit Tinggi")
  dailyNumber: number;
  refLabel: string;
  fulfilment: string;
  dateStr: string;
  lines: CustomerReceiptLine[];
  totalCents: number;
  cashTenderedCents: number;
  changeCents: number;
};

/** "text" centered in the full width (truncated if it's somehow longer). */
function center(text: string): string {
  const t = text.slice(0, W);
  return " ".repeat(Math.floor((W - t.length) / 2)) + t;
}

/**
 * Build the customer copy as 32-col lines: a shop-name banner, then the same
 * header, but priced + totalled. (Only the customer copy names the shop — the
 * barista ticket deliberately doesn't.)
 */
export function buildCustomerReceiptLines(data: CustomerReceiptData): string[] {
  const out: string[] = [];

  out.push(center(data.shopName.toUpperCase()));
  out.push(divider);
  out.push(row(`Order #${data.dailyNumber}`, `Ref #${data.refLabel}`));
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
  }

  out.push(divider);
  out.push(row("TOTAL", formatCents(data.totalCents)));
  out.push(row("Cash", formatCents(data.cashTenderedCents)));
  out.push(row("Change", formatCents(data.changeCents)));
  out.push(divider);
  out.push("Thank you!");
  return out;
}
