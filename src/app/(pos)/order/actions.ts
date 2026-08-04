"use server";

import { revalidatePath } from "next/cache";

import {
  createOrder,
  getActiveItemsWithOptions,
  getOrderById,
  markOrderPaid,
  replaceOrderLines,
  requireSession,
} from "@/lib/dal";
import {
  buildOrderLine,
  computeChangeCents,
  type OrderLineDraft,
  type OrderLineInput,
} from "@/lib/order";

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
  tableLabel: string | null;
  lines: OrderLineInput[];
}): Promise<PlaceOrderResult> {
  await requireSession();

  if (!input.idempotencyKey) return { ok: false, error: "Missing order key." };
  if (!input.lines?.length) return { ok: false, error: "The ticket is empty." };

  // null = Takeaway; a string (possibly "") = Dine-in, trimmed.
  const tableLabel =
    input.tableLabel === null ? null : input.tableLabel.trim();

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
      tableLabel,
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

/**
 * Replace the lines of an existing UNPAID order (edit-before-payment). Same
 * anti-tamper boundary as placeOrder: the client sends only ids + quantities +
 * notes and every line is RE-PRICED here from the catalog. Refuses once the
 * order is paid (nothing has printed for the barista before payment, so editing
 * an unpaid order is safe). No idempotency key — this is keyed by orderId, and
 * replaceOrderLines is itself guarded by `status = unpaid`.
 */
export async function editOrder(input: {
  orderId: string;
  tableLabel: string | null;
  lines: OrderLineInput[];
}): Promise<PlaceOrderResult> {
  await requireSession();

  if (!input.lines?.length) return { ok: false, error: "The ticket is empty." };

  const tableLabel =
    input.tableLabel === null ? null : input.tableLabel.trim();

  try {
    const order = await getOrderById(input.orderId);
    if (!order) return { ok: false, error: "Order not found." };
    if (order.status === "paid") {
      return { ok: false, error: "This order is paid and can no longer be edited." };
    }

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

    const saved = await replaceOrderLines(input.orderId, {
      totalCents,
      tableLabel,
      lines: drafts,
    });
    if (!saved) {
      return { ok: false, error: "This order is paid and can no longer be edited." };
    }
    // The order detail + recent list cache the old lines/total — refresh.
    revalidatePath(`/order/${input.orderId}`);
    revalidatePath("/recent");
    return { ok: true, orderId: input.orderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save the order.",
    };
  }
}

export type PayOrderResult = { ok: true } | { ok: false; error: string };

/**
 * Take an unpaid order to paid (Phase 4.5). The client sends only the cash
 * tendered; the change is recomputed here from the order's stored total and the
 * tender is rejected if it's short. Idempotent: paying an already-paid order is
 * a no-op success (a double-tap can't double-charge).
 */
export async function payOrder(input: {
  orderId: string;
  tenderedCents: number;
}): Promise<PayOrderResult> {
  await requireSession();

  const order = await getOrderById(input.orderId);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "paid") return { ok: true }; // already settled

  try {
    const changeCents = computeChangeCents(order.totalCents, input.tenderedCents);
    const paid = await markOrderPaid(order.id, {
      tenderedCents: input.tenderedCents,
      changeCents,
    });
    if (!paid) return { ok: false, error: "Order was already paid." };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Payment failed.",
    };
  }
}
