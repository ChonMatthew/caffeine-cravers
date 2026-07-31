"use client";

// The post-placement actions. Both are deliberately inert in Phase 4:
//   • Print unpaid receipt — the BLE transport + ESC/POS receipt builder land
//     in Phase 5 (the app-bar chip already owns the connection).
//   • Make payment — the cash keypad / change flow is Phase 4.5.
// They render in their real positions so the screen is complete, but are
// disabled with an honest note rather than faking behaviour.
export function PlacedActions() {
  return (
    <>
      <div className="flow-actions">
        <button className="btn ghost" aria-disabled="true" disabled>
          Print unpaid receipt
        </button>
        <button className="btn primary" aria-disabled="true" disabled>
          Make payment →
        </button>
      </div>
      <p className="stub-note">
        Receipt printing arrives in Phase 5; payment in Phase 4.5. The order is
        saved as <strong>unpaid</strong>.
      </p>
    </>
  );
}
