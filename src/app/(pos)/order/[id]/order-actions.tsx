"use client";

// Client actions for the order detail screen. Two states:
//   unpaid → Edit order + Make payment (NO printing — nothing goes to the
//            barista until the order is paid).
//   paid   → Print ticket (the barista's make-order; doubles as Reprint) + New
//            order. Printing never gates anything: the order is already saved,
//            so a printer that's off just shows a message.

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

  return (
    <>
      <div className="flow-actions">
        {paid ? (
          <>
            <button
              className="btn ghost"
              onClick={print}
              disabled={phase === "printing"}
            >
              {phase === "printing" ? "Printing…" : "Print ticket"}
            </button>
            <Link href="/order" className="btn primary">
              New order →
            </Link>
          </>
        ) : (
          <>
            <Link href={`/order/${orderId}/edit`} className="btn ghost">
              Edit order
            </Link>
            <Link href={`/order/${orderId}/pay`} className="btn primary">
              Make payment →
            </Link>
          </>
        )}
      </div>

      {paid && msg && (
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
