import "server-only"; // never bundle the data layer into client code

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/db";
import {
  items,
  optionGroups,
  options,
  orderItems,
  orders,
  type Item,
  type ItemWithOptions,
  type Order,
  type OrderItem,
} from "@/db/schema";
import type { OrderLineDraft } from "@/lib/order";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// The stall reconciles cash by LOCAL day, never UTC (CLAUDE.md pinned fact).
const STALL_TIMEZONE = "Asia/Kuala_Lumpur";

// The real auth boundary. proxy.ts only redirects browsers; Server Actions are
// POST endpoints anyone can hit directly, so enforcement lives here. cache()
// memoizes the check for one request pass.
export const requireSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    throw new Error("Unauthorized");
  }
  return { role: "operator" as const };
});

// The single place the app reads the catalog from. Every read requires a
// session first.

/** All items, active and inactive — for the catalog management screen. */
export async function getAllItems(): Promise<Item[]> {
  await requireSession();
  return db.select().from(items).orderBy(asc(items.name));
}

/** Only active items — for the order/till screen. */
export async function getActiveItems(): Promise<Item[]> {
  await requireSession();
  return db
    .select()
    .from(items)
    .where(eq(items.isActive, true))
    .orderBy(asc(items.name));
}

type ItemWrite = { name: string; priceCents: number; category: string | null };

export async function createItem(data: ItemWrite): Promise<void> {
  await requireSession();
  await db.insert(items).values(data);
}

export async function updateItem(id: string, data: ItemWrite): Promise<void> {
  await requireSession();
  await db.update(items).set(data).where(eq(items.id, id));
}

export async function setItemActive(id: string, active: boolean): Promise<void> {
  await requireSession();
  await db.update(items).set({ isActive: active }).where(eq(items.id, id));
}

// --- catalog with variations -------------------------------------------------

/**
 * Every item with its option groups and options nested, ordered for display.
 * One round-trip via the relational query API. Includes inactive items/options
 * so the management screen can reactivate them.
 */
export async function getCatalog(): Promise<ItemWithOptions[]> {
  await requireSession();
  return db.query.items.findMany({
    orderBy: (i, { asc }) => asc(i.name),
    with: {
      optionGroups: {
        orderBy: (g, { asc }) => [asc(g.sortOrder), asc(g.name)],
        with: {
          options: {
            orderBy: (o, { asc }) => [asc(o.sortOrder), asc(o.name)],
          },
        },
      },
    },
  });
}

type GroupWrite = { name: string; required: boolean };

export async function createOptionGroup(
  itemId: string,
  data: GroupWrite,
): Promise<void> {
  await requireSession();
  await db.insert(optionGroups).values({ itemId, ...data });
}

/** Hard delete — cascades to the group's options. Safe: orders snapshot lines. */
export async function deleteOptionGroup(id: string): Promise<void> {
  await requireSession();
  await db.delete(optionGroups).where(eq(optionGroups.id, id));
}

type OptionWrite = { name: string; priceDeltaCents: number };

export async function createOption(
  groupId: string,
  data: OptionWrite,
): Promise<void> {
  await requireSession();
  await db.insert(options).values({ groupId, ...data });
}

/** Hard delete a single option. Safe for the same reason as groups. */
export async function deleteOption(id: string): Promise<void> {
  await requireSession();
  await db.delete(options).where(eq(options.id, id));
}

/** Soft toggle: hide an option from the order screen without losing the row. */
export async function setOptionActive(
  id: string,
  active: boolean,
): Promise<void> {
  await requireSession();
  await db.update(options).set({ isActive: active }).where(eq(options.id, id));
}

// --- order flow (Phase 4) ----------------------------------------------------

/**
 * The order screen's read: active items only, each with its option groups and
 * only their ACTIVE options, ordered for display. One round-trip.
 */
export async function getActiveItemsWithOptions(): Promise<ItemWithOptions[]> {
  await requireSession();
  return db.query.items.findMany({
    where: (i, { eq }) => eq(i.isActive, true),
    orderBy: (i, { asc }) => asc(i.name),
    with: {
      optionGroups: {
        orderBy: (g, { asc }) => [asc(g.sortOrder), asc(g.name)],
        with: {
          options: {
            where: (o, { eq }) => eq(o.isActive, true),
            orderBy: (o, { asc }) => [asc(o.sortOrder), asc(o.name)],
          },
        },
      },
    },
  });
}

export type CreateOrderInput = {
  idempotencyKey: string;
  totalCents: number;
  tableLabel: string | null;
  lines: OrderLineDraft[];
};

/**
 * Persist an unpaid order and its lines in one transaction. The idempotency key
 * is the anti-double-charge guard: a retry with the same key inserts nothing
 * and returns the order that already exists. Returns the order id either way.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<{ id: string; created: boolean }> {
  await requireSession();
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(orders)
      .values({
        status: "unpaid",
        totalCents: input.totalCents,
        tableLabel: input.tableLabel,
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({ target: orders.idempotencyKey })
      .returning({ id: orders.id });

    // Conflict: this key already produced an order. Don't insert lines again.
    if (inserted.length === 0) {
      const existing = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.idempotencyKey, input.idempotencyKey));
      return { id: existing[0].id, created: false };
    }

    const orderId = inserted[0].id;
    await tx.insert(orderItems).values(
      input.lines.map((l) => ({
        orderId,
        itemId: l.itemId,
        itemName: l.itemName,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        note: l.note,
        optionsSnapshot: l.options,
      })),
    );
    return { id: orderId, created: true };
  });
}

/**
 * Replace an unpaid order's lines and total in one transaction (in-place edit
 * before payment). The `status = unpaid` guard makes it safe: if the order was
 * paid in the meantime the UPDATE touches zero rows and we return false without
 * deleting anything. The order's identity (id, order_seq, created_at) is
 * untouched — only its lines/total/fulfilment change.
 */
export async function replaceOrderLines(
  id: string,
  data: { totalCents: number; tableLabel: string | null; lines: OrderLineDraft[] },
): Promise<boolean> {
  await requireSession();
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(orders)
      .set({ totalCents: data.totalCents, tableLabel: data.tableLabel })
      .where(and(eq(orders.id, id), eq(orders.status, "unpaid")))
      .returning({ id: orders.id });
    if (updated.length === 0) return false; // paid or gone — leave lines as-is

    await tx.delete(orderItems).where(eq(orderItems.orderId, id));
    await tx.insert(orderItems).values(
      data.lines.map((l) => ({
        orderId: id,
        itemId: l.itemId,
        itemName: l.itemName,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        note: l.note,
        optionsSnapshot: l.options,
      })),
    );
    return true;
  });
}

/**
 * Take an unpaid order to paid, in one conditional UPDATE. The `status = unpaid`
 * guard makes it safe against a double-pay / race: a second call updates zero
 * rows and returns null. Change is computed by the caller (server-side).
 */
export async function markOrderPaid(
  id: string,
  data: { tenderedCents: number; changeCents: number },
): Promise<{ id: string } | null> {
  await requireSession();
  const rows = await db
    .update(orders)
    .set({
      status: "paid",
      cashTenderedCents: data.tenderedCents,
      changeCents: data.changeCents,
      paidAt: new Date(),
    })
    .where(and(eq(orders.id, id), eq(orders.status, "unpaid")))
    .returning({ id: orders.id });
  return rows[0] ?? null;
}

/** An order with its lines + its per-day number — for the placed/detail screen. */
export type OrderWithItems = Order & {
  items: OrderItem[];
  /** 1-based position among orders on the same LOCAL day ("Order 12 today"). */
  dailyNumber: number;
};

export async function getOrderById(
  id: string,
): Promise<OrderWithItems | null> {
  await requireSession();
  const row = await db.query.orders.findFirst({
    where: (o, { eq }) => eq(o.id, id),
    with: { items: true },
  });
  if (!row) return null;

  // Daily number = how many orders on this order's local day have an order_seq
  // at or below this one. Stable (later orders never change it) and resets each
  // day for free, without a stored counter.
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        sql`(${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date = (${row.createdAt.toISOString()}::timestamptz AT TIME ZONE ${STALL_TIMEZONE})::date`,
        sql`${orders.orderSeq} <= ${row.orderSeq}`,
      ),
    );
  return { ...row, dailyNumber: n };
}

/** One row on the Incomplete Orders page — an unpaid order to resume/settle. */
export type UnpaidOrderRow = {
  id: string;
  orderSeq: number;
  dailyNumber: number;
  tableLabel: string | null;
  totalCents: number;
  createdAt: Date;
};

/**
 * Every unpaid order (the "incomplete" queue), newest first, each with its
 * per-day number computed inline (count of same-local-day orders up to it).
 */
export async function getUnpaidOrders(): Promise<UnpaidOrderRow[]> {
  await requireSession();
  return db
    .select({
      id: orders.id,
      orderSeq: orders.orderSeq,
      tableLabel: orders.tableLabel,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      dailyNumber: sql<number>`(
        select count(*)::int from orders o2
        where (o2.created_at AT TIME ZONE ${STALL_TIMEZONE})::date
            = (${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date
          and o2.order_seq <= ${orders.orderSeq}
      )`,
    })
    .from(orders)
    .where(eq(orders.status, "unpaid"))
    .orderBy(desc(orders.createdAt));
}

/**
 * Today's takings for the home day-strip, bucketed by the stall's LOCAL day
 * (not UTC). Counts every order placed today; the money total is what has
 * actually been paid so far.
 */
export async function getTodaySummary(): Promise<{
  orderCount: number;
  paidCents: number;
}> {
  await requireSession();
  const localToday = sql`(${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date = (now() AT TIME ZONE ${STALL_TIMEZONE})::date`;
  const rows = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      paidCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'paid'), 0)::int`,
    })
    .from(orders)
    .where(localToday);
  return rows[0] ?? { orderCount: 0, paidCents: 0 };
}
