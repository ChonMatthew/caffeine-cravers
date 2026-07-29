import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

// DB-backed rate limiting. An in-memory Map is useless on serverless (each
// invocation may be a fresh instance), so shared state lives in the database.

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;

async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for; take the first (client) address.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** True if this IP has too many recent failures and should be blocked. */
export async function isRateLimited(): Promise<boolean> {
  const ip = await clientIp();
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ip, ip),
        eq(loginAttempts.ok, false),
        gte(loginAttempts.attemptedAt, since),
      ),
    );
  return (rows[0]?.count ?? 0) >= MAX_FAILURES;
}

/** Record the outcome of a login attempt for this IP. */
export async function recordAttempt(ok: boolean): Promise<void> {
  const ip = await clientIp();
  await db.insert(loginAttempts).values({ ip, ok });
}
