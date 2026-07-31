import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { OptionSnapshot } from "@/lib/order";

// --- items: the menu catalog --------------------------------------------------
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(), // gen_random_uuid()
    name: text("name").notNull(),
    // Money is stored as whole cents in an integer. Never a float/decimal.
    priceCents: integer("price_cents").notNull(),
    category: text("category"), // nullable
    // Optional item photo. Column added now (free); the upload UI ships later.
    imageUrl: text("image_url"), // nullable
    // Soft-delete: deactivate instead of deleting, so history stays intact.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("items_price_nonneg", sql`${t.priceCents} >= 0`)],
);

// --- option_groups: per-item choice groups, e.g. "Size", "Temp" ---------------
// A group belongs to one item and holds mutually-exclusive options (single-
// select). `required` means an order line for this item must pick one option.
export const optionGroups = pgTable(
  "option_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Delete an item and its groups (and their options) go with it.
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Size", "Temp"
    required: boolean("required").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  // We always read a group by its item, so index that foreign key.
  (t) => [index("option_groups_item_idx").on(t.itemId)],
);

// --- options: the choices inside a group, each nudging the price --------------
// `price_delta_cents` ADDS to the item's base price (Large = +200). No order
// row points here (lines snapshot name+delta at sale time), so a row can be
// hard-deleted safely; `is_active` just hides it from the order screen.
export const options = pgTable(
  "options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Small", "Large", "Iced"
    priceDeltaCents: integer("price_delta_cents").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("options_group_idx").on(t.groupId)],
);

// --- relations: ORM-only wiring (no SQL/migration) ---------------------------
// These let `db.query.items.findMany({ with: { optionGroups: … } })` fetch the
// whole nested shape in one query instead of hand-stitching three selects.
export const itemsRelations = relations(items, ({ many }) => ({
  optionGroups: many(optionGroups),
}));

export const optionGroupsRelations = relations(
  optionGroups,
  ({ one, many }) => ({
    item: one(items, {
      fields: [optionGroups.itemId],
      references: [items.id],
    }),
    options: many(options),
  }),
);

export const optionsRelations = relations(options, ({ one }) => ({
  group: one(optionGroups, {
    fields: [options.groupId],
    references: [optionGroups.id],
  }),
}));

// --- orders: one completed (or voided) sale ----------------------------------
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Order lifecycle: 'unpaid' -> 'paid'. An order is persisted 'unpaid' the
    // moment it's placed (Phase 4); Phase 4.5 takes it to 'paid'. We never
    // DELETE a sale. ('paid' is admitted by the check now so 4.5 only adds
    // columns, not another constraint migration.)
    status: text("status").notNull().default("unpaid"),
    totalCents: integer("total_cents").notNull(),
    // Payment (Phase 4.5). Null until the order is paid. Cash only — the amount
    // handed over and the change given back, both recomputed server-side.
    cashTenderedCents: integer("cash_tendered_cents"), // nullable
    changeCents: integer("change_cents"), // nullable
    paidAt: timestamp("paid_at", { withTimezone: true }), // nullable
    // Anti-double-charge: the client sends one key per cart; a retry with the
    // same key can't create a second order (enforced by the UNIQUE index).
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("orders_total_nonneg", sql`${t.totalCents} >= 0`),
    check("orders_status_valid", sql`${t.status} in ('unpaid', 'paid')`),
    check(
      "orders_tendered_nonneg",
      sql`${t.cashTenderedCents} is null or ${t.cashTenderedCents} >= 0`,
    ),
    check(
      "orders_change_nonneg",
      sql`${t.changeCents} is null or ${t.changeCents} >= 0`,
    ),
    // Reports group by day; without this index that query table-scans.
    index("orders_created_at_idx").on(t.createdAt),
  ],
);

// --- order_items: the lines on an order --------------------------------------
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Lines belong to an order; delete the order and its lines go with it.
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // Points at the catalog item, but nullable: if an item is later deleted,
    // the line survives (the snapshot columns below preserve what was sold).
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    // Snapshots taken at sale time — immune to later menu edits.
    itemName: text("item_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    // Optional per-line note the operator typed in the add pop-up ("no sugar").
    note: text("note"), // nullable
    // The chosen options, snapshotted as {name, priceDeltaCents} so a reprint or
    // report shows exactly what was sold even after the catalog is edited.
    optionsSnapshot: jsonb("options_snapshot")
      .$type<OptionSnapshot[]>()
      .notNull()
      .default([]),
  },
  (t) => [check("order_items_qty_pos", sql`${t.quantity} > 0`)],
);

// Order <-> lines wiring for nested reads (db.query.orders.findFirst({ with })).
export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

// --- Inferred types: the app imports these instead of hand-writing shapes -----
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type OptionGroup = typeof optionGroups.$inferSelect;
export type NewOptionGroup = typeof optionGroups.$inferInsert;
// Named ItemOption (not Option) to avoid clashing with the DOM's global Option.
export type ItemOption = typeof options.$inferSelect;
export type NewItemOption = typeof options.$inferInsert;

// An item with its groups, each group with its options — the catalog read shape.
export type ItemWithOptions = Item & {
  optionGroups: (OptionGroup & { options: ItemOption[] })[];
};
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
