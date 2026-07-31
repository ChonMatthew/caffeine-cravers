"use server";

import {
  createOrder,
  getActiveItemsWithOptions,
  requireSession,
} from "@/lib/dal";
import { buildOrderLine, type OrderLineDraft, type OrderLineInput } from "@/lib/order";

export type PlaceOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

/**
 * Persist the current ticket as an `unpaid` order.
 *
 * The client sends only ids + quantities + notes. Every line is RE-PRICED here
 * from the catalog (buildOrderLine) and the total is summed server-side — a
 * tampered client price never reaches the DB. The idempotency key makes a retry
 * safe: it returns the existing order instead of creating a second one.
 */
export async function placeOrder(input: {
  idempotencyKey: string;
  lines: OrderLineInput[];
}): Promise<PlaceOrderResult> {
  await requireSession();

  if (!input.idempotencyKey) return { ok: false, error: "Missing order key." };
  if (!input.lines?.length) return { ok: false, error: "The ticket is empty." };

  try {
    const catalog = await getActiveItemsWithOptions();
    const byId = new Map(catalog.map((i) => [i.id, i]));

    const drafts: OrderLineDraft[] = [];
    for (const line of input.lines) {
      const item = byId.get(line.itemId);
      if (!item) {
        return { ok: false, error: "An item on the ticket is no longer available." };
      }
      drafts.push(buildOrderLine(item, line));
    }

    const totalCents = drafts.reduce(
      (sum, d) => sum + d.unitPriceCents * d.quantity,
      0,
    );

    const { id } = await createOrder({
      idempotencyKey: input.idempotencyKey,
      totalCents,
      lines: drafts,
    });
    return { ok: true, orderId: id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not place the order.",
    };
  }
}
