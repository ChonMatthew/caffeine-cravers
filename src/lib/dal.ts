import "server-only"; // never bundle the data layer into client code

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { db } from "@/db";
import {
  items,
  optionGroups,
  options,
  orderItems,
  orders,
  shops,
  type Item,
  type ItemWithOptions,
  type Order,
  type OrderItem,
  type Shop,
} from "@/db/schema";
import {
  formatRef,
  type OptionSnapshot,
  type OrderLineDraft,
  type Station,
} from "@/lib/order";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// The stall reconciles cash by LOCAL day, never UTC (CLAUDE.md pinned fact).
const STALL_TIMEZONE = "Asia/Kuala_Lumpur";

// The real auth boundary. proxy.ts only redirects browsers; Server Actions are
// POST endpoints anyone can hit directly, so enforcement lives here. cache()
// memoizes the check for one request pass.
//
// On an absent/expired session we `redirect('/login')` rather than throwing a
// raw "Unauthorized": a Server Component page then bounces cleanly to login
// instead of hitting an error screen, and Server Actions do too. Safe because
// every action calls this at its TOP, before any try/catch — so the redirect's
// control-flow signal is never swallowed — and cache() makes the nested DAL
// calls inside those try blocks memoized no-ops.
//
// It also returns the session's shop — the ONLY source of shopId in the app.
// Every DAL read/write below scopes by it; a shop id from client input is never
// trusted (CLAUDE.md: shop scoping is a hard divide, enforced here).
export const requireSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const shopId = await verifySessionToken(token);
  if (shopId === null) {
    redirect("/login");
  }
  return { role: "operator" as const, shopId };
});

/** Both shops, for the login picker. Public on purpose: no session yet. */
export async function getShops(): Promise<Shop[]> {
  // The login page reads no cookies, so without this Next would prerender it at
  // build time (and need the DB then). Render it per request instead.
  await connection();
  return db.select().from(shops).orderBy(asc(shops.name));
}

/** True when `id` is a real shop — login validates the picked shop with this. */
export async function shopExists(id: string): Promise<boolean> {
  const rows = await db
    .select({ id: shops.id })
    .from(shops)
    .where(eq(shops.id, id));
  return rows.length > 0;
}

/** The logged-in shop (name for the header/receipt, prefix for Ref #s). */
export const getCurrentShop = cache(async (): Promise<Shop> => {
  const { shopId } = await requireSession();
  const [shop] = await db.select().from(shops).where(eq(shops.id, shopId));
  // A signed token naming a shop that doesn't exist: treat as logged out.
  if (!shop) redirect("/login");
  return shop;
});

// The single place the app reads the catalog from. Every read requires a
// session first, and only ever sees the session's shop.

/** All items, active and inactive — for the catalog management screen. */
export async function getAllItems(): Promise<Item[]> {
  const { shopId } = await requireSession();
  return db
    .select()
    .from(items)
    .where(eq(items.shopId, shopId))
    .orderBy(asc(items.name));
}

/** Only active items — for the order/till screen. */
export async function getActiveItems(): Promise<Item[]> {
  const { shopId } = await requireSession();
  return db
    .select()
    .from(items)
    .where(and(eq(items.shopId, shopId), eq(items.isActive, true)))
    .orderBy(asc(items.name));
}

type ItemWrite = {
  name: string;
  priceCents: number;
  category: string | null;
  station: Station;
};

export async function createItem(data: ItemWrite): Promise<void> {
  const { shopId } = await requireSession();
  await db.insert(items).values({ ...data, shopId });
}

// Writes by id also match the session's shop, so a stale form from the other
// shop's catalog updates nothing.
export async function updateItem(id: string, data: ItemWrite): Promise<void> {
  const { shopId } = await requireSession();
  await db
    .update(items)
    .set(data)
    .where(and(eq(items.id, id), eq(items.shopId, shopId)));
}

export async function setItemActive(id: string, active: boolean): Promise<void> {
  const { shopId } = await requireSession();
  await db
    .update(items)
    .set({ isActive: active })
    .where(and(eq(items.id, id), eq(items.shopId, shopId)));
}

// Option groups/options carry no shop_id — they inherit it via their item. These
// subqueries are "ids that belong to this shop", for scoping writes by id.
function shopItemIds(shopId: string) {
  return db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.shopId, shopId));
}

function shopGroupIds(shopId: string) {
  return db
    .select({ id: optionGroups.id })
    .from(optionGroups)
    .innerJoin(items, eq(optionGroups.itemId, items.id))
    .where(eq(items.shopId, shopId));
}

// --- catalog with variations -------------------------------------------------

/**
 * Every item with its option groups and options nested, ordered for display.
 * One round-trip via the relational query API. Includes inactive items/options
 * so the management screen can reactivate them.
 */
export async function getCatalog(): Promise<ItemWithOptions[]> {
  const { shopId } = await requireSession();
  return db.query.items.findMany({
    where: (i, { eq }) => eq(i.shopId, shopId),
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

/** Adds a group to one of this shop's items; an item from another shop is a no-op. */
export async function createOptionGroup(
  itemId: string,
  data: GroupWrite,
): Promise<void> {
  const { shopId } = await requireSession();
  const owned = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.shopId, shopId)));
  if (owned.length === 0) return;
  await db.insert(optionGroups).values({ itemId, ...data });
}

/** Hard delete — cascades to the group's options. Safe: orders snapshot lines. */
export async function deleteOptionGroup(id: string): Promise<void> {
  const { shopId } = await requireSession();
  await db
    .delete(optionGroups)
    .where(
      and(eq(optionGroups.id, id), inArray(optionGroups.itemId, shopItemIds(shopId))),
    );
}

/** Flip whether an existing group must resolve to exactly one option. */
export async function setGroupRequired(
  id: string,
  required: boolean,
): Promise<void> {
  const { shopId } = await requireSession();
  await db
    .update(optionGroups)
    .set({ required })
    .where(
      and(eq(optionGroups.id, id), inArray(optionGroups.itemId, shopItemIds(shopId))),
    );
}

type OptionWrite = { name: string; priceDeltaCents: number };

/** Adds an option to one of this shop's groups; another shop's group is a no-op. */
export async function createOption(
  groupId: string,
  data: OptionWrite,
): Promise<void> {
  const { shopId } = await requireSession();
  const owned = await db
    .select({ id: optionGroups.id })
    .from(optionGroups)
    .innerJoin(items, eq(optionGroups.itemId, items.id))
    .where(and(eq(optionGroups.id, groupId), eq(items.shopId, shopId)));
  if (owned.length === 0) return;
  await db.insert(options).values({ groupId, ...data });
}

/** Hard delete a single option. Safe for the same reason as groups. */
export async function deleteOption(id: string): Promise<void> {
  const { shopId } = await requireSession();
  await db
    .delete(options)
    .where(and(eq(options.id, id), inArray(options.groupId, shopGroupIds(shopId))));
}

/** Soft toggle: hide an option from the order screen without losing the row. */
export async function setOptionActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { shopId } = await requireSession();
  await db
    .update(options)
    .set({ isActive: active })
    .where(and(eq(options.id, id), inArray(options.groupId, shopGroupIds(shopId))));
}

// --- order flow (Phase 4) ----------------------------------------------------

/**
 * The order screen's read: active items only, each with its option groups and
 * only their ACTIVE options, ordered for display. One round-trip.
 */
export async function getActiveItemsWithOptions(): Promise<ItemWithOptions[]> {
  const { shopId } = await requireSession();
  return db.query.items.findMany({
    // Shop-scoped, so placeOrder/editOrder (which reprice from this) reject an
    // item from the other shop as "no longer available".
    where: (i, { and, eq }) => and(eq(i.shopId, shopId), eq(i.isActive, true)),
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
 *
 * The shop's next Ref # is computed inside the same INSERT, so a retry that
 * hits the idempotency conflict burns no number (no gap). UNIQUE (shop_id,
 * ref_no) rejects — never duplicates — if two inserts ever raced.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<{ id: string; created: boolean }> {
  const { shopId } = await requireSession();
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(orders)
      .values({
        shopId,
        refNo: sql`(select coalesce(max(o2.ref_no), 0) + 1 from orders o2 where o2.shop_id = ${shopId})`,
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
        station: l.station,
      })),
    );
    return { id: orderId, created: true };
  });
}

/**
 * Replace an unpaid order's lines and total in one transaction (in-place edit
 * before payment). The `status = unpaid` guard makes it safe: if the order was
 * paid in the meantime the UPDATE touches zero rows and we return false without
 * deleting anything. The order's identity (id, ref_no, created_at) is
 * untouched — only its lines/total/fulfilment change. Another shop's order
 * matches zero rows, same as a paid one.
 */
export async function replaceOrderLines(
  id: string,
  data: { totalCents: number; tableLabel: string | null; lines: OrderLineDraft[] },
): Promise<boolean> {
  const { shopId } = await requireSession();
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(orders)
      .set({ totalCents: data.totalCents, tableLabel: data.tableLabel })
      .where(
        and(
          eq(orders.id, id),
          eq(orders.shopId, shopId),
          eq(orders.status, "unpaid"),
        ),
      )
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
        station: l.station,
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
  const { shopId } = await requireSession();
  const rows = await db
    .update(orders)
    .set({
      status: "paid",
      cashTenderedCents: data.tenderedCents,
      changeCents: data.changeCents,
      paidAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, id),
        eq(orders.shopId, shopId),
        eq(orders.status, "unpaid"),
      ),
    )
    .returning({ id: orders.id });
  return rows[0] ?? null;
}

/** An order with its lines + its per-day number — for the placed/detail screen. */
export type OrderWithItems = Order & {
  items: OrderItem[];
  /** 1-based position among the SHOP's orders on the same LOCAL day ("Order 12 today"). */
  dailyNumber: number;
  /** The printed Ref #, shop prefix included ("BT-12"). */
  refLabel: string;
};

/** One of this shop's orders, or null — another shop's order id is not found. */
export async function getOrderById(
  id: string,
): Promise<OrderWithItems | null> {
  const { shopId } = await requireSession();
  const row = await db.query.orders.findFirst({
    where: (o, { and, eq }) => and(eq(o.id, id), eq(o.shopId, shopId)),
    with: { items: true },
  });
  if (!row) return null;

  // Daily number = how many of this shop's orders on this order's local day
  // have a ref_no at or below this one. Stable (later orders never change it)
  // and resets each day for free, without a stored counter.
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shopId),
        sql`(${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date = (${row.createdAt.toISOString()}::timestamptz AT TIME ZONE ${STALL_TIMEZONE})::date`,
        sql`${orders.refNo} <= ${row.refNo}`,
      ),
    );
  const shop = await getCurrentShop();
  return { ...row, dailyNumber: n, refLabel: formatRef(shop.refPrefix, row.refNo) };
}

// An order's per-day number, as a correlated subquery for list selects: how
// many of the SAME shop's orders on the same local day have a ref_no at or
// below it.
// NOTE: reference the OUTER order's columns as literal `orders.<col>`, not
// ${orders.createdAt}. On a single-table select Drizzle emits columns
// unqualified ("ref_no"), which the correlated subquery then binds to its own
// `o2` — counting every order in the day for every row. Qualifying with the
// outer range name `orders` fixes the correlation.
const dailyNumberExpr = sql<number>`(
  select count(*)::int from orders o2
  where o2.shop_id = orders.shop_id
    and (o2.created_at AT TIME ZONE ${STALL_TIMEZONE})::date
      = (orders.created_at AT TIME ZONE ${STALL_TIMEZONE})::date
    and o2.ref_no <= orders.ref_no
)`;

/** One row on the Recent screen — any order from the last rolling 24 hours. */
export type RecentOrderRow = {
  id: string;
  refNo: number;
  dailyNumber: number;
  status: string; // 'unpaid' | 'paid'
  tableLabel: string | null;
  totalCents: number;
  createdAt: Date;
};

/**
 * Orders from the last rolling 24 HOURS — paid and unpaid, newest first, each
 * with its per-day number. A rolling window (not "today") on purpose: the stall
 * sometimes trades past midnight, and a calendar-day cutoff would drop the
 * early-hours tickets the operator still wants to see and reprint. The Recent
 * screen splits these into the unpaid queue and the paid reprint archive.
 */
export async function getRecentOrders(): Promise<RecentOrderRow[]> {
  const { shopId } = await requireSession();
  return db
    .select({
      id: orders.id,
      refNo: orders.refNo,
      status: orders.status,
      tableLabel: orders.tableLabel,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      dailyNumber: dailyNumberExpr,
    })
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shopId),
        sql`${orders.createdAt} >= now() - interval '24 hours'`,
      ),
    )
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
  const { shopId } = await requireSession();
  const localToday = sql`(${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date = (now() AT TIME ZONE ${STALL_TIMEZONE})::date`;
  const rows = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      paidCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} = 'paid'), 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.shopId, shopId), localToday));
  return rows[0] ?? { orderCount: 0, paidCents: 0 };
}

// The stall-local day of an order as a 'YYYY-MM-DD' string. Reports bucket by
// this, never by UTC, or a late-night sale lands on the wrong day and the totals
// stop reconciling with the cash box (CLAUDE.md pinned fact).
const localDayExpr = sql<string>`to_char((${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date, 'YYYY-MM-DD')`;

/** One row on the reports day list: a local day with its PAID takings. */
export type DailySalesRow = {
  day: string; // 'YYYY-MM-DD' in the stall's local timezone
  paidOrders: number;
  revenueCents: number;
};

/**
 * Daily sales, newest day first — PAID orders only (req #10). Revenue is the sum
 * of paid order totals; unpaid/abandoned tickets never count. Bucketed by the
 * stall's LOCAL day.
 */
export async function getDailySales(): Promise<DailySalesRow[]> {
  const { shopId } = await requireSession();
  // Group/order by OUTPUT POSITION (the 1st select column), not by re-emitting
  // the day expression: Drizzle renders the column unqualified in SELECT but
  // qualified in GROUP BY, and Postgres then sees two different expressions and
  // rejects the group. `group by 1` sidesteps that entirely.
  return db
    .select({
      day: localDayExpr,
      paidOrders: sql<number>`count(*)::int`,
      revenueCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.shopId, shopId), eq(orders.status, "paid")))
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`);
}

/** One item/variation line in a day's breakdown: what was sold, how many, for how much. */
export type ItemBreakdownRow = {
  itemName: string;
  options: OptionSnapshot[]; // the chosen variation snapshot ([] = no options)
  quantity: number;
  revenueCents: number;
};

/**
 * Per item + variation breakdown, PAID orders only, busiest first. Groups by the
 * item name AND its exact option snapshot, so "Iced Latte / Large" and "Iced
 * Latte / Small" are separate rows (req #10 decision). Prices come from the
 * sale-time snapshot, immune to later catalog edits.
 *
 * `localDay` is a 'YYYY-MM-DD' string (validated by the caller) for one local
 * day, or `null` for the all-time view. When given, it's cast to ::date in SQL,
 * so a malformed value would raise a cast error.
 */
export async function getItemBreakdown(
  localDay: string | null,
): Promise<ItemBreakdownRow[]> {
  const { shopId } = await requireSession();
  const dayMatch = localDay
    ? sql`(${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date = ${localDay}::date`
    : undefined;
  return db
    .select({
      itemName: orderItems.itemName,
      options: orderItems.optionsSnapshot,
      quantity: sql<number>`sum(${orderItems.quantity})::int`,
      revenueCents: sql<number>`sum(${orderItems.unitPriceCents} * ${orderItems.quantity})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.shopId, shopId), eq(orders.status, "paid"), dayMatch))
    .groupBy(orderItems.itemName, orderItems.optionsSnapshot)
    .orderBy(
      sql`sum(${orderItems.quantity}) desc`,
      asc(orderItems.itemName),
    );
}

/**
 * Headline figures for the report dashboard — PAID orders only, for one local
 * day (`localDay`) or all-time (`null`). Cash figures back the drawer count:
 * `revenueCents` is what should be in the box; tendered − change reconciles to
 * it. Fulfilment counts split dine-in (table_label set) from takeaway (null).
 */
export type ReportSummary = {
  paidOrders: number;
  revenueCents: number;
  itemsSold: number;
  dineInCount: number;
  takeawayCount: number;
  tenderedCents: number;
  changeCents: number;
};

export async function getReportSummary(
  localDay: string | null,
): Promise<ReportSummary> {
  const { shopId } = await requireSession();
  const dayMatch = localDay
    ? sql`(${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date = ${localDay}::date`
    : undefined;

  // Order-level aggregates (revenue, cash, fulfilment split) in one pass.
  const [agg] = await db
    .select({
      paidOrders: sql<number>`count(*)::int`,
      revenueCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      tenderedCents: sql<number>`coalesce(sum(${orders.cashTenderedCents}), 0)::int`,
      changeCents: sql<number>`coalesce(sum(${orders.changeCents}), 0)::int`,
      dineInCount: sql<number>`(count(*) filter (where ${orders.tableLabel} is not null))::int`,
      takeawayCount: sql<number>`(count(*) filter (where ${orders.tableLabel} is null))::int`,
    })
    .from(orders)
    .where(and(eq(orders.shopId, shopId), eq(orders.status, "paid"), dayMatch));

  // Item count lives on the lines, so it needs the join.
  const [line] = await db
    .select({
      itemsSold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.shopId, shopId), eq(orders.status, "paid"), dayMatch));

  return {
    paidOrders: agg?.paidOrders ?? 0,
    revenueCents: agg?.revenueCents ?? 0,
    tenderedCents: agg?.tenderedCents ?? 0,
    changeCents: agg?.changeCents ?? 0,
    dineInCount: agg?.dineInCount ?? 0,
    takeawayCount: agg?.takeawayCount ?? 0,
    itemsSold: line?.itemsSold ?? 0,
  };
}

/** One hour-of-day bucket for the "Trading Day" chart. `hour` is 0–23, local. */
export type HourlyRow = {
  hour: number;
  orders: number;
  revenueCents: number;
};

/**
 * PAID orders bucketed by hour-of-day in the stall's LOCAL timezone, for one day
 * (`localDay`) or across all days (`null` — the all-time view then shows the
 * stall's typical trading shape). Only hours with sales are returned; the caller
 * fills the gaps. Grouped/ordered by output position (see getDailySales).
 */
export async function getHourlyBreakdown(
  localDay: string | null,
): Promise<HourlyRow[]> {
  const { shopId } = await requireSession();
  const dayMatch = localDay
    ? sql`(${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date = ${localDay}::date`
    : undefined;
  return db
    .select({
      hour: sql<number>`extract(hour from (${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE}))::int`,
      orders: sql<number>`count(*)::int`,
      revenueCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.shopId, shopId), eq(orders.status, "paid"), dayMatch))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
}

/** One line in a day's order log — an individual PAID order, for reprint. */
export type DayOrderRow = {
  id: string;
  dailyNumber: number;
  tableLabel: string | null;
  itemCount: number;
  totalCents: number;
  createdAt: Date;
};

/**
 * Every individual PAID order for one local day (`localDay`) or all-time
 * (`null`), in the order they were placed (so their per-day numbers read 1..N).
 * Paid only, to match the report's revenue scope — these rows sum to the day's
 * takings. Each carries its item count (sum of line quantities) and links out to
 * the order detail for reprinting.
 */
export async function getOrdersForDay(
  localDay: string | null,
): Promise<DayOrderRow[]> {
  const { shopId } = await requireSession();
  const dayMatch = localDay
    ? sql`(${orders.createdAt} AT TIME ZONE ${STALL_TIMEZONE})::date = ${localDay}::date`
    : undefined;
  return db
    .select({
      id: orders.id,
      tableLabel: orders.tableLabel,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      dailyNumber: dailyNumberExpr,
      itemCount: sql<number>`(
        select coalesce(sum(order_items.quantity), 0)::int
        from order_items where order_items.order_id = orders.id
      )`,
    })
    .from(orders)
    .where(and(eq(orders.shopId, shopId), eq(orders.status, "paid"), dayMatch))
    .orderBy(asc(orders.refNo));
}
