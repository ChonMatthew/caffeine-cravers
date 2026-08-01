import { notFound } from "next/navigation";

import { getOrderById } from "@/lib/dal";
import { formatCents } from "@/lib/money";
import { formatFulfilment } from "@/lib/order";
import type { ReceiptData } from "@/lib/receipt";

import { OrderActions } from "./order-actions";

// Receipt date/time in the stall's local timezone.
const receiptDateFmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Order detail — the Placed (unpaid) state or the Paid state, chosen by status.
// Next 16: `params` is a Promise. Print + payment/new-order actions live in the
// client OrderActions; this Server Component assembles the receipt payload.
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const paid = order.status === "paid";

  const receipt: ReceiptData = {
    stallName: "CAFFEINE CRAVERS",
    dailyNumber: order.dailyNumber,
    recordNumber: order.orderSeq,
    fulfilment: formatFulfilment(order.tableLabel),
    dateStr: receiptDateFmt.format(order.createdAt),
    lines: order.items.map((l) => ({
      quantity: l.quantity,
      itemName: l.itemName,
      options: l.optionsSnapshot.map((o) => o.name),
      note: l.note,
      unitPriceCents: l.unitPriceCents,
    })),
    totalCents: order.totalCents,
    payment: paid
      ? {
          status: "paid",
          tenderedCents: order.cashTenderedCents ?? 0,
          changeCents: order.changeCents ?? 0,
        }
      : { status: "unpaid" },
  };

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
          </>
        )}

        <OrderActions receipt={receipt} orderId={id} paid={paid} />
      </div>
    </main>
  );
}
