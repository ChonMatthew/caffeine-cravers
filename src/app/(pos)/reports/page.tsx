import Link from "next/link";

import { getDailySales, getItemBreakdown } from "@/lib/dal";
import { formatCents } from "@/lib/money";

// Daily sales report (Phase 6, req #10): PAID orders only, bucketed by the
// stall's LOCAL day in the DAL. The day list is the left rail; picking a day
// (?day=YYYY-MM-DD) shows its item/variation breakdown. Next 16: `searchParams`
// is a Promise. Server Component — reads the DAL directly.

// A 'YYYY-MM-DD' local-date string → "Mon 04 Aug". Formatted in UTC so the plain
// date parts render as-is (the string is already the stall-local day).
const dayLabelFmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayLabel(day: string): string {
  return dayLabelFmt.format(new Date(`${day}T00:00:00Z`));
}

/** "Large · Iced" — the chosen variation names for a breakdown row. */
function variationLabel(options: { name: string }[]): string {
  return options.map((o) => o.name).join(" · ");
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day } = await searchParams;
  const days = await getDailySales();

  // Only trust a well-formed date param (it's cast to ::date in SQL); otherwise
  // default to the most recent day with sales.
  const requested = day && ISO_DAY.test(day) ? day : null;
  const selectedDay =
    (requested && days.some((d) => d.day === requested) ? requested : null) ??
    days[0]?.day ??
    null;

  const selectedRow = days.find((d) => d.day === selectedDay) ?? null;
  const breakdown = selectedDay ? await getItemBreakdown(selectedDay) : [];

  const grandCents = days.reduce((sum, d) => sum + d.revenueCents, 0);
  const grandOrders = days.reduce((sum, d) => sum + d.paidOrders, 0);

  return (
    <main className="report">
      <div className="cat-head">
        <h1>Reports</h1>
        <span className="count">
          {days.length} day{days.length === 1 ? "" : "s"} ·{" "}
          {formatCents(grandCents)} paid
        </span>
      </div>
      <p className="cat-sub">
        Paid sales only, by day (Asia/Kuala_Lumpur). Pick a day for its item
        breakdown.
      </p>

      {days.length === 0 ? (
        <p className="novar">No paid sales yet.</p>
      ) : (
        <div className="rep-grid">
          {/* ---------- day list ---------- */}
          <div className="rep-days">
            {days.map((d) => (
              <Link
                key={d.day}
                href={`/reports?day=${d.day}`}
                className={`rep-day${d.day === selectedDay ? " on" : ""}`}
                aria-current={d.day === selectedDay}
              >
                <span className="rd-date">{dayLabel(d.day)}</span>
                <span className="rd-count">
                  {d.paidOrders} order{d.paidOrders === 1 ? "" : "s"}
                </span>
                <span className="rd-rev">{formatCents(d.revenueCents)}</span>
              </Link>
            ))}
            <div className="rep-day total" aria-hidden>
              <span className="rd-date">All-time</span>
              <span className="rd-count">
                {grandOrders} order{grandOrders === 1 ? "" : "s"}
              </span>
              <span className="rd-rev">{formatCents(grandCents)}</span>
            </div>
          </div>

          {/* ---------- selected-day breakdown ---------- */}
          <div className="rep-detail">
            {selectedRow && (
              <div className="rep-dhead">
                <h2>{dayLabel(selectedRow.day)}</h2>
                <span className="rep-dsum">
                  {selectedRow.paidOrders} paid ·{" "}
                  {formatCents(selectedRow.revenueCents)}
                </span>
              </div>
            )}

            {breakdown.length === 0 ? (
              <p className="novar">No lines for this day.</p>
            ) : (
              <div className="rep-items">
                {breakdown.map((row, i) => {
                  const vr = variationLabel(row.options);
                  return (
                    <div className="rep-item" key={`${row.itemName}-${vr}-${i}`}>
                      <span className="ri-qty">{row.quantity}×</span>
                      <span className="ri-name">
                        {row.itemName}
                        {vr && <span className="ri-vr"> · {vr}</span>}
                      </span>
                      <span className="ri-rev">
                        {formatCents(row.revenueCents)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
