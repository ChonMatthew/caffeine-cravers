import "server-only"; // never bundle the data layer into client code

import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/db";
import { items, type Item } from "@/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

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
