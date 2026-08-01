import Link from "next/link";

import { getUnpaidOrders } from "@/lib/dal";
import { formatCents } from "@/lib/money";
import { formatFulfilment } from "@/lib/order";

// Incomplete Orders (#4): orders placed but not yet paid. The operator opens one
// to take payment (or to see abandoned tickets). Server Component; the time is
// formatted in the stall's local timezone.
const timeFmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function IncompletePage() {
  const rows = await getUnpaidOrders();

  return (
    <main className="incomplete">
      <div className="cat-head">
        <h1>Incomplete</h1>
        <span className="count">{rows.length} unpaid</span>
      </div>
      <p className="cat-sub">
        Orders placed but not yet paid. Open one to take payment.
      </p>

      {rows.length === 0 ? (
        <p className="novar">No unpaid orders — all settled.</p>
      ) : (
        <div className="inc-list">
          {rows.map((o) => (
            <Link key={o.id} href={`/order/${o.id}`} className="inc-row">
              <span className="inc-num">#{o.dailyNumber}</span>
              <span className="inc-fulfil">{formatFulfilment(o.tableLabel)}</span>
              <span className="inc-time">{timeFmt.format(o.createdAt)}</span>
              <span className="inc-total">{formatCents(o.totalCents)}</span>
              <span className="inc-go">Take payment →</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
