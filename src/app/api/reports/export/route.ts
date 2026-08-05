import {
  getDailySales,
  getHourlyBreakdown,
  getItemBreakdown,
  getOrdersForDay,
  getReportSummary,
  requireSession,
} from "@/lib/dal";
import { formatFulfilment } from "@/lib/order";
import { buildReportText } from "@/lib/report-text";

// The report export — the ONE sanctioned route handler (CLAUDE.md architecture).
// GET /api/reports/export?day=YYYY-MM-DD | all → the daily (or all-time) sales
// report as plain text, served inline so it opens in the browser to read/print.
// requireSession() is the real gate (proxy.ts also redirects unauthed browsers).

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Day heading includes the year (this is a saved document, not just a tab label).
const dayLabelFmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const genFmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const timeFmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function dayLabel(day: string): string {
  return dayLabelFmt.format(new Date(`${day}T00:00:00Z`));
}

export async function GET(request: Request) {
  await requireSession(); // redirects to /login if the session is missing/expired

  const dayParam = new URL(request.url).searchParams.get("day");
  const isAll = dayParam === "all";

  // Resolve the selected day the same way the report page does.
  const days = await getDailySales();
  const requested =
    !isAll && dayParam && ISO_DAY.test(dayParam) ? dayParam : null;
  const selectedDay = isAll
    ? null
    : ((requested && days.some((d) => d.day === requested) ? requested : null) ??
      days[0]?.day ??
      null);

  const generatedAt = `${genFmt.format(new Date())} (Asia/Kuala_Lumpur)`;

  // No day resolves (there are no paid sales at all) — a minimal empty report.
  if (!isAll && selectedDay === null) {
    const text = [
      "CAFFEINE CRAVERS — SALES REPORT",
      "No paid sales yet",
      `Generated ${generatedAt}`,
      "",
    ].join("\n");
    return textResponse(text, "report-none.txt");
  }

  const [summary, hourly, breakdown, orders] = await Promise.all([
    getReportSummary(selectedDay),
    getHourlyBreakdown(selectedDay),
    getItemBreakdown(selectedDay),
    isAll ? Promise.resolve([]) : getOrdersForDay(selectedDay),
  ]);

  const text = buildReportText({
    title: isAll ? "All-time" : dayLabel(selectedDay!),
    generatedAt,
    isAll,
    summary,
    hourly,
    breakdown: breakdown.map((b) => ({
      itemName: b.itemName,
      variation: b.options.map((o) => o.name).join(" · "),
      quantity: b.quantity,
      revenueCents: b.revenueCents,
    })),
    orders: orders.map((o) => ({
      dailyNumber: o.dailyNumber,
      time: timeFmt.format(o.createdAt),
      fulfilment: formatFulfilment(o.tableLabel),
      itemCount: o.itemCount,
      totalCents: o.totalCents,
    })),
  });

  return textResponse(text, `report-${isAll ? "all-time" : selectedDay}.txt`);
}

function textResponse(text: string, filename: string): Response {
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // inline: open in the browser to read/print; the name is used if saved.
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
