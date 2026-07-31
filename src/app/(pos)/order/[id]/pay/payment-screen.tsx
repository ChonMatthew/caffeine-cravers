"use client";

// Cash payment (Phase 4.5). Build the tendered amount on the keypad or tap a
// quick-cash / Exact button; change due is shown live. Confirm is gated until
// tendered ≥ total. The server (payOrder) recomputes the change and rejects a
// short tender — this screen is just input. Non-cash tender is out of scope.

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";

import { formatCents } from "@/lib/money";

import { payOrder } from "../../actions";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];
const MAX_TENDERED = 9_999_999; // RM 99,999.99 ceiling on keypad entry

export function PaymentScreen({
  orderId,
  totalCents,
}: {
  orderId: string;
  totalCents: number;
}) {
  const router = useRouter();
  const [tendered, setTendered] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paying, startPaying] = useTransition();

  const enough = tendered >= totalCents;
  const change = enough ? tendered - totalCents : null;

  const press = (k: string) => {
    setError(null);
    setTendered((t) => {
      let next = t;
      if (k === "⌫") next = Math.floor(t / 10);
      else if (k === "00") next = t * 100;
      else next = t * 10 + Number(k);
      return Math.min(next, MAX_TENDERED);
    });
  };

  const quick = (cents: number) => {
    setError(null);
    setTendered(cents);
  };

  const confirm = () => {
    if (!enough || paying) return;
    setError(null);
    startPaying(async () => {
      const res = await payOrder({ orderId, tenderedCents: tendered });
      if (res.ok) router.push(`/order/${orderId}`);
      else setError(res.error);
    });
  };

  return (
    <main className="flow">
      <div className="flowcard">
        <h2>Payment</h2>
        <div className="sub">Cash · enter amount tendered</div>

        <div className="paygrid">
          <div className="pay-left">
            <div className="due total">
              <div className="lab">Total due</div>
              <div className="val">{formatCents(totalCents)}</div>
            </div>
            <div className="due">
              <div className="lab">Tendered</div>
              <div className="val" style={{ color: "var(--ink)" }}>
                {formatCents(tendered)}
              </div>
            </div>
            <div className="due change">
              <div className="lab">Change due</div>
              <div className="val">
                {change === null ? "—" : formatCents(change)}
              </div>
            </div>
            <div className="quick">
              <button onClick={() => quick(totalCents)}>Exact</button>
              <button onClick={() => quick(1000)}>RM 10</button>
              <button onClick={() => quick(2000)}>RM 20</button>
              <button onClick={() => quick(5000)}>RM 50</button>
            </div>
          </div>

          <div className="keypad">
            {KEYS.map((k) => (
              <button key={k} onClick={() => press(k)} aria-label={k === "⌫" ? "Delete" : k}>
                {k}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="stub-note" style={{ color: "var(--brick)" }} role="alert">
            {error}
          </p>
        )}

        <div className="flow-actions">
          <Link href={`/order/${orderId}`} className="btn ghost">
            ← Back
          </Link>
          <button
            className="btn primary"
            disabled={!enough || paying}
            onClick={confirm}
          >
            {paying ? "Confirming…" : "Confirm payment"}
          </button>
        </div>
      </div>
    </main>
  );
}
