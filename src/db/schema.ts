import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// --- items: the menu catalog --------------------------------------------------
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(), // gen_random_uuid()
    name: text("name").notNull(),
    // Money is stored as whole cents in an integer. Never a float/decimal.
    priceCents: integer("price_cents").notNull(),
    category: text("category"), // nullable
    // Soft-delete: deactivate instead of deleting, so history stays intact.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("items_price_nonneg", sql`${t.priceCents} >= 0`)],
);

// --- orders: one completed (or voided) sale ----------------------------------
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 'completed' | 'voided'. Voiding flips this flag — we never DELETE a sale.
    status: text("status").notNull().default("completed"),
    totalCents: integer("total_cents").notNull(),
    // Anti-double-charge: the client sends one key per cart; a retry with the
    // same key can't create a second order (enforced by the UNIQUE index).
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("orders_total_nonneg", sql`${t.totalCents} >= 0`),
    check("orders_status_valid", sql`${t.status} in ('completed', 'voided')`),
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
  },
  (t) => [check("order_items_qty_pos", sql`${t.quantity} > 0`)],
);

// --- Inferred types: the app imports these instead of hand-writing shapes -----
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
