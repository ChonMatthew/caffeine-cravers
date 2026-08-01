import Link from "next/link";
import { notFound } from "next/navigation";

import { getOrderById } from "@/lib/dal";
import { formatCents } from "@/lib/money";
import { formatFulfilment } from "@/lib/order";

// Order detail — the Placed (unpaid) state or the Paid state, chosen by status.
// Next 16: `params` is a Promise. Print buttons are Phase-5 stubs (the app-bar
// chip owns the BLE connection; the ESC/POS receipt builder lands in Phase 5).
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const paid = order.status === "paid";

  return (
    <main className="flow">
      <div className="flowcard">
        <div className="mark ok" aria-hidden>
          ✓
        </div>
        <h2>{paid ? "Paid" : "Order Placed"}</h2>
        <div className="ordernum">
          Order #{order.dailyNumber}
          <span className="rec">record #{order.orderSeq}</span>
        </div>
        <div className="sub">
          {formatFulfilment(order.tableLabel)} · {paid ? "Complete" : "Saved · unpaid"}
        </div>

        {paid ? (
          <>
            <div
              className="due change"
              style={{ margin: "0 auto 4px", maxWidth: 280, textAlign: "center" }}
            >
              <div className="lab">Change due</div>
              <div className="val">{formatCents(order.changeCents ?? 0)}</div>
            </div>
            <div className="sub">
              {formatCents(order.cashTenderedCents ?? 0)} tendered ·{" "}
              {formatCents(order.totalCents)} total
            </div>
            <div className="flow-actions">
              <button className="btn ghost" aria-disabled="true" disabled>
                Print receipt
              </button>
              <Link href="/order" className="btn primary">
                New order →
              </Link>
            </div>
            <p className="stub-note">Receipt printing arrives in Phase 5.</p>
          </>
        ) : (
          <>
            <div>
              {order.items.map((line) => {
                const vr = line.optionsSnapshot.map((o) => o.name).join(" · ");
                return (
                  <div className="sumrow" key={line.id}>
                    <span>
                      {line.quantity}× {line.itemName}
                      {vr && <span className="sub-vr"> · {vr}</span>}
                      {line.note && <span className="sub-vr"> · “{line.note}”</span>}
                    </span>
                    <span className="a">
                      {formatCents(line.unitPriceCents * line.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="sum-total">
              <span className="lbl">Total</span>
              <span className="amt">{formatCents(order.totalCents)}</span>
            </div>
            <div className="flow-actions">
              <button className="btn ghost" aria-disabled="true" disabled>
                Print unpaid receipt
              </button>
              <Link href={`/order/${id}/pay`} className="btn primary">
                Make payment →
              </Link>
            </div>
            <p className="stub-note">
              Unpaid receipt printing arrives in Phase 5.
            </p>
            <Link href="/order" className="btn link">
              Start a new order →
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
