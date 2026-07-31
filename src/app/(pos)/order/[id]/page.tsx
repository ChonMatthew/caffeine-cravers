import Link from "next/link";
import { notFound } from "next/navigation";

import { getOrderById } from "@/lib/dal";
import { formatCents } from "@/lib/money";

import { PlacedActions } from "./placed-actions";

// The "Order Placed" screen. In Next 16 route `params` is a Promise.
// Phase 4 ends here (order persisted `unpaid`). The action buttons — print the
// unpaid receipt (Phase 5) and take payment (Phase 4.5) — are stubbed until
// those phases land; this is also the future Reprint / order-detail surface.
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const ref = `#${id.slice(0, 8)}`;

  return (
    <main className="flow">
      <div className="flowcard">
        <div className="mark ok" aria-hidden>
          ✓
        </div>
        <h2>Order Placed</h2>
        <div className="sub">
          Ticket {ref} saved · {order.status}
        </div>

        <div>
          {order.items.map((line) => {
            const vr = line.optionsSnapshot.map((o) => o.name).join(" · ");
            return (
              <div className="sumrow" key={line.id}>
                <span>
                  {line.quantity}× {line.itemName}
                  {vr && <span className="sub-vr"> · {vr}</span>}
                  {line.note && (
                    <span className="sub-vr"> · “{line.note}”</span>
                  )}
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

        <PlacedActions />

        <Link href="/order" className="btn link">
          Start a new order →
        </Link>
      </div>
    </main>
  );
}
