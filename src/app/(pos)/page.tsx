import Link from "next/link";

import { getTodaySummary } from "@/lib/dal";
import { formatCents } from "@/lib/money";

// The home hub (req #1): pick a station. Not a redirect to /order — three big
// destination keys plus a live day-strip. Server Component; reads today's
// takings from the DAL (bucketed by the stall's local day).
export default async function HomePage() {
  const { orderCount, paidCents } = await getTodaySummary();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";

  return (
    <main className="home">
      <div className="home-head">
        <h1>{greeting}</h1>
        <p>Pick a station to get going.</p>
      </div>

      <div className="keys">
        <Link href="/order" className="dest primary">
          <div className="d-ico" aria-hidden>
            ▤
          </div>
          <div className="d-mid">
            <h2>Order</h2>
            <div className="d-sub">Take a sale · build a ticket</div>
          </div>
          <div className="d-go" aria-hidden>
            →
          </div>
        </Link>

        <Link href="/catalog" className="dest">
          <div className="d-ico" aria-hidden>
            ▦
          </div>
          <div className="d-mid">
            <h2>Catalog</h2>
            <div className="d-sub">Manage the menu &amp; variations</div>
          </div>
          <div className="d-go" aria-hidden>
            →
          </div>
        </Link>

        <Link href="/reports" className="dest">
          <div className="d-ico" aria-hidden>
            ▧
          </div>
          <div className="d-mid">
            <h2>Report</h2>
            <div className="d-sub">Daily sales &amp; item counts</div>
          </div>
          <div className="d-go" aria-hidden>
            →
          </div>
        </Link>
      </div>

      <div className="daystrip">
        <span>
          Today · <b>{orderCount}</b> order{orderCount === 1 ? "" : "s"}
        </span>
        <span>
          Paid · <b>{formatCents(paidCents)}</b>
        </span>
        <span className="pill">
          <span className="g" aria-hidden /> Stall open
        </span>
      </div>
    </main>
  );
}
