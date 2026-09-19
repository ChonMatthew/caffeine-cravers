"use client";

// Client actions for the order detail screen. Two states:
//   unpaid → Edit order + Make payment (NO printing — nothing goes to the
//            barista until the order is paid).
//   paid   → Print ticket (the barista's make-order; doubles as Reprint) + New
//            order, plus an opt-in Print customer copy. Printing never gates
//            anything: the order is already saved, so a printer that's off
//            just shows a message.
//
// An order with both food and drink lines prints as TWO chits (station-split,
// see lib/receipt.ts), sent one after another over the one connection
// PrinterProvider holds today. They're independent print jobs on purpose: once
// a second physical printer exists, routing each job to its own connection is
// a change to printer-context + this loop, not to the split logic itself.
//
// The customer copy is a separate, manual action — never automatic, never
// station-split — so the kitchen/barista flow stays exactly what it was
// rebuilt to be; a customer who wants a priced copy is the exception, not
// the default.

import Link from "next/link";
import { useState } from "react";

import { encodeReceipt } from "@/lib/escpos";
import type { Station } from "@/lib/order";
import { usePrinter } from "@/lib/printer-context";
import {
  buildCustomerReceiptLines,
  buildStationTicketLines,
  splitReceiptByStation,
  type CustomerReceiptData,
  type ReceiptData,
} from "@/lib/receipt";

type Phase = "idle" | "printing" | "sent" | "error";

export function OrderActions({
  receipt,
  customerReceipt,
  orderId,
  paid,
}: {
  receipt: ReceiptData;
  customerReceipt: CustomerReceiptData | null;
  orderId: string;
  paid: boolean;
}) {
  const printer = usePrinter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [copyPhase, setCopyPhase] = useState<Phase>("idle");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const notConnectedMsg =
    printer.status === "unsupported"
      ? "No Web Bluetooth in this browser — open in Bluefy (iPad) or Chrome."
      : "Printer not connected — tap the printer chip in the top bar first.";

  async function print() {
    if (printer.status !== "connected") {
      setPhase("error");
      setMsg(notConnectedMsg);
      return;
    }

    const split = splitReceiptByStation(receipt);
    const jobs = (Object.entries(split) as [Station, ReceiptData][]).map(
      ([station, data]) => encodeReceipt(buildStationTicketLines(data, station)),
    );

    setPhase("printing");
    setMsg(null);
    try {
      // Sequential, not concurrent: today both stations share one physical
      // connection, and two writes racing the same characteristic would
      // interleave their bytes.
      for (const bytes of jobs) {
        await printer.print(bytes);
      }
      setPhase("sent");
      setMsg(jobs.length > 1 ? "Sent 2 tickets to printer." : "Sent to printer.");
    } catch (err) {
      setPhase("error");
      setMsg(err instanceof Error ? err.message : "Print failed.");
    }
  }

  async function printCustomerCopy() {
    if (!customerReceipt) return;
    if (printer.status !== "connected") {
      setCopyPhase("error");
      setCopyMsg(notConnectedMsg);
      return;
    }

    setCopyPhase("printing");
    setCopyMsg(null);
    try {
      await printer.print(encodeReceipt(buildCustomerReceiptLines(customerReceipt)));
      setCopyPhase("sent");
      setCopyMsg("Sent to printer.");
    } catch (err) {
      setCopyPhase("error");
      setCopyMsg(err instanceof Error ? err.message : "Print failed.");
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

      {paid && customerReceipt && (
        <div className="flow-secondary">
          <button
            type="button"
            className="mini"
            onClick={printCustomerCopy}
            disabled={copyPhase === "printing"}
          >
            {copyPhase === "printing" ? "Printing…" : "Print customer copy"}
          </button>
        </div>
      )}

      {paid && copyMsg && (
        <p
          className="stub-note"
          style={{ color: copyPhase === "error" ? "var(--brick)" : "var(--jade)" }}
          role="status"
        >
          {copyMsg}
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
