// Shown while a POS screen's server data is in flight (route transitions).
// Minimal on purpose — the till should feel instant, not staged.
export default function PosLoading() {
  return (
    <main className="flow">
      <div className="flowcard" style={{ textAlign: "center" }}>
        <div className="sub" role="status">
          Loading…
        </div>
      </div>
    </main>
  );
}
