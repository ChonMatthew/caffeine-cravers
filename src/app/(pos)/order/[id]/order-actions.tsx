"use client";

// Client actions for the order detail screen: the real Print button (unpaid or
// final receipt) plus the primary nav (Make payment / New order). Printing never
// gates anything — if the printer isn't connected we just say so; the order is
// already saved, and this button doubles as Reprint.

import Link from "next/link";
import { useState } from "react";

import { encodeReceipt } from "@/lib/escpos";
import { usePrinter } from "@/lib/printer-context";
import { buildReceiptLines, type ReceiptData } from "@/lib/receipt";

type Phase = "idle" | "printing" | "sent" | "error";

export function OrderActions({
  receipt,
  orderId,
  paid,
}: {
  receipt: ReceiptData;
  orderId: string;
  paid: boolean;
}) {
  const printer = usePrinter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function print() {
    if (printer.status !== "connected") {
      setPhase("error");
      setMsg(
        printer.status === "unsupported"
          ? "No Web Bluetooth in this browser — open in Bluefy (iPad) or Chrome."
          : "Printer not connected — tap the printer chip in the top bar first.",
      );
      return;
    }
    setPhase("printing");
    setMsg(null);
    try {
      await printer.print(encodeReceipt(buildReceiptLines(receipt)));
      setPhase("sent");
      setMsg("Sent to printer.");
    } catch (err) {
      setPhase("error");
      setMsg(err instanceof Error ? err.message : "Print failed.");
    }
  }

  const printLabel =
    phase === "printing"
      ? "Printing…"
      : paid
        ? "Print receipt"
        : "Print unpaid receipt";

  return (
    <>
      <div className="flow-actions">
        <button className="btn ghost" onClick={print} disabled={phase === "printing"}>
          {printLabel}
        </button>
        {paid ? (
          <Link href="/order" className="btn primary">
            New order →
          </Link>
        ) : (
          <Link href={`/order/${orderId}/pay`} className="btn primary">
            Make payment →
          </Link>
        )}
      </div>

      {msg && (
        <p
          className="stub-note"
          style={{ color: phase === "error" ? "var(--brick)" : "var(--jade)" }}
          role="status"
        >
          {msg}
        </p>
      )}

      {!paid && (
        <Link href="/order" className="btn link">
          Start a new order →
        </Link>
      )}
    </>
  );
}
