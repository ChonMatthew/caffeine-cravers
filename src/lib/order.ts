// Pure order/pricing logic — no React, no DB, no navigator. Kept side-effect
// free so it unit-tests cleanly and behaves identically on server and client.
// Phase 4 will grow this file with the cart reducer; for now it owns pricing.

/**
 * One option the operator picked for a line. We carry the delta (and name) so a
 * line can be priced and later snapshotted onto an order row without another DB
 * read — the order stays correct even if the catalog is edited afterwards.
 */
export type SelectedOption = {
  groupId: string;
  optionId: string;
  name: string;
  priceDeltaCents: number;
};

/**
 * An item's base price plus every chosen option's delta. Integer cents in,
 * integer cents out. Clamped at 0 so a stray negative delta can never produce a
 * negative line price — money math must never surprise the till.
 */
export function resolveUnitPrice(
  baseCents: number,
  selected: readonly SelectedOption[],
): number {
  const total = selected.reduce(
    (sum, opt) => sum + opt.priceDeltaCents,
    baseCents,
  );
  return Math.max(0, total);
}
