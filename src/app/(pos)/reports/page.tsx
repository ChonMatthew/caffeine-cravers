import Link from "next/link";

import {
  getDailySales,
  getHourlyBreakdown,
  getItemBreakdown,
  getReportSummary,
  type HourlyRow,
} from "@/lib/dal";
import { formatCents } from "@/lib/money";

// Reports (Phase 6, redesigned): PAID orders only, bucketed by the stall's LOCAL
// day in the DAL. The left rail lists each day (with a trend bar) plus an
// all-time entry; picking one (?day=YYYY-MM-DD or ?day=all) renders the same
// dashboard — headline figures, the hourly "Trading Day" chart, cash-drawer
// reconciliation, fulfilment split, and the item breakdown. Next 16:
// `searchParams` is a Promise. Server Component — reads the DAL directly.

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

/** 0–23 → "7a" / "12p" / "5p" — a compact hour tick for the trading chart. */
function hourLabel(hour: number): string {
  const period = hour < 12 ? "a" : "p";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${period}`;
}

/**
 * Fill the gaps: DAL returns only hours that had sales, so pad from the first
 * to the last selling hour with zero-revenue buckets. Keeps the chart's x-axis
 * continuous (an empty 2pm reads as a real lull, not a missing bar).
 */
function denseHours(rows: HourlyRow[]): HourlyRow[] {
  if (rows.length === 0) return [];
  const byHour = new Map(rows.map((r) => [r.hour, r]));
  const first = rows[0].hour;
  const last = rows[rows.length - 1].hour;
  const out: HourlyRow[] = [];
  for (let h = first; h <= last; h++) {
    out.push(byHour.get(h) ?? { hour: h, orders: 0, revenueCents: 0 });
  }
  return out;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day } = await searchParams;
  const days = await getDailySales();

  // Selection: 'all' → all-time (null day filter); a valid, present ISO day →
  // that day; otherwise the most recent day with sales.
  const isAll = day === "all";
  const requested = !isAll && day && ISO_DAY.test(day) ? day : null;
  const selectedDay = isAll
    ? null
    : ((requested && days.some((d) => d.day === requested) ? requested : null) ??
      days[0]?.day ??
      null);
  // What the rail highlights: the day string, or the literal "all".
  const selectedKey = isAll ? "all" : selectedDay;

  const [summary, hourly, breakdown] = await Promise.all([
    getReportSummary(selectedDay),
    getHourlyBreakdown(selectedDay),
    getItemBreakdown(selectedDay),
  ]);

  const grandCents = days.reduce((sum, d) => sum + d.revenueCents, 0);
  const grandOrders = days.reduce((sum, d) => sum + d.paidOrders, 0);
  const maxDayRev = Math.max(1, ...days.map((d) => d.revenueCents));

  const avgCents = summary.paidOrders
    ? Math.round(summary.revenueCents / summary.paidOrders)
    : 0;

  const bars = denseHours(hourly);
  const maxHourRev = Math.max(1, ...bars.map((b) => b.revenueCents));
  const fulfilTotal = summary.dineInCount + summary.takeawayCount;
  const dineInPct = fulfilTotal
    ? Math.round((summary.dineInCount / fulfilTotal) * 100)
    : 0;
  const topQty = Math.max(1, ...breakdown.map((r) => r.quantity));

  const title = isAll ? "All-time" : selectedDay ? dayLabel(selectedDay) : "—";

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
        Paid sales only, by day (Asia/Kuala_Lumpur). Pick a day, or All-time, for
        its full breakdown.
      </p>

      {days.length === 0 ? (
        <p className="novar">No paid sales yet.</p>
      ) : (
        <div className="rep-grid">
          {/* ---------- day rail (doubles as a revenue trend) ---------- */}
          <div className="rep-days">
            {days.map((d) => {
              const pct = Math.round((d.revenueCents / maxDayRev) * 100);
              return (
                <Link
                  key={d.day}
                  href={`/reports?day=${d.day}`}
                  className={`rep-day${d.day === selectedKey ? " on" : ""}`}
                  aria-current={d.day === selectedKey}
                >
                  <span className="rd-date">{dayLabel(d.day)}</span>
                  <span className="rd-count">
                    {d.paidOrders} order{d.paidOrders === 1 ? "" : "s"}
                  </span>
                  <span className="rd-rev mono">{formatCents(d.revenueCents)}</span>
                  <span className="rd-bar" aria-hidden>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                </Link>
              );
            })}
            <Link
              href="/reports?day=all"
              className={`rep-day total${isAll ? " on" : ""}`}
              aria-current={isAll}
            >
              <span className="rd-date">All-time</span>
              <span className="rd-count">
                {grandOrders} order{grandOrders === 1 ? "" : "s"}
              </span>
              <span className="rd-rev mono">{formatCents(grandCents)}</span>
            </Link>
          </div>

          {/* ---------- selected view: the dashboard ---------- */}
          <div className="rep-detail">
            <div className="rep-dhead">
              <h2>{title}</h2>
              <span className="rep-dsum">
                {summary.paidOrders} paid · {formatCents(summary.revenueCents)}
              </span>
            </div>

            {/* headline figures — kept as a quiet strip, not big stat cards */}
            <div className="rep-kpis">
              <div className="kpi">
                <span className="k-val mono">{formatCents(summary.revenueCents)}</span>
                <span className="k-lbl">Revenue</span>
              </div>
              <div className="kpi">
                <span className="k-val mono">{summary.paidOrders}</span>
                <span className="k-lbl">Orders</span>
              </div>
              <div className="kpi">
                <span className="k-val mono">{formatCents(avgCents)}</span>
                <span className="k-lbl">Avg ticket</span>
              </div>
              <div className="kpi">
                <span className="k-val mono">{summary.itemsSold}</span>
                <span className="k-lbl">Items sold</span>
              </div>
            </div>

            {/* the signature: hour-by-hour shape of the trading day */}
            <section className="rep-block">
              <div className="rep-bhead">
                <h3 className="rep-h3">The Trading Day</h3>
                <span className="rep-cap">
                  {isAll ? "by hour, across all days" : "revenue by hour"}
                </span>
              </div>
              {bars.length === 0 ? (
                <p className="novar">No sales in this period.</p>
              ) : (
                <div className="trade">
                  {bars.map((b) => {
                    const pct = Math.round((b.revenueCents / maxHourRev) * 100);
                    return (
                      <div
                        className="trade-col"
                        key={b.hour}
                        title={`${hourLabel(b.hour)} · ${b.orders} order${b.orders === 1 ? "" : "s"} · ${formatCents(b.revenueCents)}`}
                      >
                        <span className="trade-bar-wrap">
                          <i
                            className={b.revenueCents === 0 ? "trade-bar zero" : "trade-bar"}
                            style={{ height: `${pct}%` }}
                          />
                        </span>
                        <span className="trade-hr">{hourLabel(b.hour)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* cash reconciliation + fulfilment, side by side */}
            <div className="rep-two">
              <section className="rep-block">
                <h3 className="rep-h3">Cash drawer</h3>
                <div className="cash-line big">
                  <span>Expected in drawer</span>
                  <span className="mono">{formatCents(summary.revenueCents)}</span>
                </div>
                <div className="cash-line">
                  <span>Cash tendered</span>
                  <span className="mono">{formatCents(summary.tenderedCents)}</span>
                </div>
                <div className="cash-line">
                  <span>Change given</span>
                  <span className="mono">− {formatCents(summary.changeCents)}</span>
                </div>
              </section>

              <section className="rep-block">
                <h3 className="rep-h3">Fulfilment</h3>
                <div className="cash-line">
                  <span>Dine-in</span>
                  <span className="mono">{summary.dineInCount}</span>
                </div>
                <div className="cash-line">
                  <span>Takeaway</span>
                  <span className="mono">{summary.takeawayCount}</span>
                </div>
                <div className="ff-bar" aria-hidden>
                  <i className="ff-dine" style={{ width: `${dineInPct}%` }} />
                  <i className="ff-take" style={{ width: `${100 - dineInPct}%` }} />
                </div>
              </section>
            </div>

            {/* item + variation breakdown, busiest first, with share bars */}
            <section className="rep-block">
              <h3 className="rep-h3">Best sellers</h3>
              {breakdown.length === 0 ? (
                <p className="novar">No lines for this period.</p>
              ) : (
                <div className="rep-items">
                  {breakdown.map((row, i) => {
                    const vr = variationLabel(row.options);
                    const pct = Math.round((row.quantity / topQty) * 100);
                    return (
                      <div className="rep-item" key={`${row.itemName}-${vr}-${i}`}>
                        <span className="ri-qty mono">{row.quantity}×</span>
                        <span className="ri-name">
                          {row.itemName}
                          {vr && <span className="ri-vr"> · {vr}</span>}
                        </span>
                        <span className="ri-rev mono">
                          {formatCents(row.revenueCents)}
                        </span>
                        <span className="ri-share" aria-hidden>
                          <i style={{ width: `${pct}%` }} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
