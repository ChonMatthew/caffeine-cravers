import Link from "next/link";

import { getRecentOrders, type RecentOrderRow } from "@/lib/dal";
import { formatCents } from "@/lib/money";
import { formatFulfilment } from "@/lib/order";

// Recent (#4, redesigned): every order from the last rolling 24 hours, split
// into the unpaid queue (open one to take payment) and the paid archive (open
// one to reprint its barista ticket). Rolling 24h, not "today", because the
// stall sometimes trades past midnight. Server Component; times render in the
// stall's local timezone. Rows are click-through — the order detail screen owns
// both "Make payment" and "Print ticket" (reprint).

const timeFmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
// Weekday tag shown only on rows that fall on an earlier local day than "now"
// (a rolling-24h window can straddle midnight), so 09:00 yesterday reads clearly.
const dayTagFmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  weekday: "short",
});
// 'YYYY-MM-DD' in the stall's local day — used to tell "today" from "earlier".
const localDayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
});

function Row({ o, todayKey }: { o: RecentOrderRow; todayKey: string }) {
  const paid = o.status === "paid";
  const earlier = localDayKey.format(o.createdAt) !== todayKey;
  return (
    <Link
      href={`/order/${o.id}`}
      className={`rec-row ${paid ? "paid" : "unpaid"}`}
    >
      <span className="rec-num">#{o.dailyNumber}</span>
      <span className="rec-fulfil">{formatFulfilment(o.tableLabel)}</span>
      <span className="rec-time">
        {earlier && <span className="rec-daytag">{dayTagFmt.format(o.createdAt)}</span>}
        {timeFmt.format(o.createdAt)}
      </span>
      <span className="rec-total mono">{formatCents(o.totalCents)}</span>
      <span className="rec-go">{paid ? "Reprint →" : "Take payment →"}</span>
    </Link>
  );
}

export default async function RecentPage() {
  const rows = await getRecentOrders();
  const todayKey = localDayKey.format(new Date());

  const unpaid = rows.filter((o) => o.status === "unpaid");
  const paid = rows.filter((o) => o.status === "paid");

  return (
    <main className="recent">
      <div className="cat-head">
        <h1>Recent</h1>
        <span className="count">
          {rows.length} in 24h · {unpaid.length} unpaid
        </span>
      </div>
      <p className="cat-sub">
        Orders from the last 24 hours. Settle an unpaid one, or open a paid one
        to reprint its ticket.
      </p>

      {rows.length === 0 ? (
        <p className="novar">No orders in the last 24 hours.</p>
      ) : (
        <>
          {unpaid.length > 0 && (
            <section className="rec-sec">
              <div className="rec-sec-head">
                <h2>
                  <span className="rec-dot unpaid" aria-hidden />
                  Unpaid
                  <span className="rec-count">{unpaid.length}</span>
                </h2>
                <span className="rec-hint">settle these</span>
              </div>
              <div className="rec-list">
                {unpaid.map((o) => (
                  <Row key={o.id} o={o} todayKey={todayKey} />
                ))}
              </div>
            </section>
          )}

          {paid.length > 0 && (
            <section className="rec-sec">
              <div className="rec-sec-head">
                <h2>
                  <span className="rec-dot paid" aria-hidden />
                  Paid
                  <span className="rec-count">{paid.length}</span>
                </h2>
                <span className="rec-hint">reprint tickets</span>
              </div>
              <div className="rec-list">
                {paid.map((o) => (
                  <Row key={o.id} o={o} todayKey={todayKey} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
