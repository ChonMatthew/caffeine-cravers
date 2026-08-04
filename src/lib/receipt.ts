// Pure barista-ticket layout — order data in, an array of 32-column ASCII lines
// out. This is NOT a customer receipt: no stall banner, no prices, no payment —
// just what the barista needs to make the order. No React, no bytes, no I/O, so
// it snapshot-tests cleanly (read the snapshot to see the exact ticket BEFORE
// anything prints). escpos.ts turns these lines into printer bytes; printer.ts
// pushes them over BLE.

// 58mm thermal paper at Font A fits 32 characters per line.
export const RECEIPT_WIDTH = 32;

export type ReceiptLine = {
  quantity: number;
  itemName: string;
  options: string[]; // e.g. ["Large"] — the chosen variation names
  note: string | null;
};

export type ReceiptData = {
  dailyNumber: number; // "Order #12 today"
  recordNumber: number; // permanent order_seq
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

  out.push(row(`Order #${data.dailyNumber}`, `Ref #${data.recordNumber}`));
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
