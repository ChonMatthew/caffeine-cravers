import "server-only"; // never bundle the data layer into client code

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { items, type Item } from "@/db/schema";

// The single place the app reads the catalog from. Pages/actions call these;
// they never write inline queries. Phase 2 adds requireSession() here so this
// layer becomes the real auth boundary.

/** All items, active and inactive — for the catalog management screen. */
export async function getAllItems(): Promise<Item[]> {
  return db.select().from(items).orderBy(asc(items.name));
}

/** Only active items — for the order/till screen. */
export async function getActiveItems(): Promise<Item[]> {
  return db
    .select()
    .from(items)
    .where(eq(items.isActive, true))
    .orderBy(asc(items.name));
}
