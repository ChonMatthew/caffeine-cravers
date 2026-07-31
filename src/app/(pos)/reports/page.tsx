// Reports placeholder. The real daily-sales screen lands in Phase 6 (it counts
// paid orders only and breaks down per item/variation). Kept as a route now so
// the home hub and nav don't dead-end.
export default function ReportsPage() {
  return (
    <main className="reports">
      <div className="r-ico" aria-hidden>
        ▧
      </div>
      <h2>Reports</h2>
      <p>Daily sales &amp; item counts land here in a later phase.</p>
    </main>
  );
}
