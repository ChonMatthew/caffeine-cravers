import "server-only"; // fail the build if this is ever imported client-side

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

// Reuse one client across dev hot-reloads, otherwise each reload opens a new
// connection pool until Supabase runs out of connections.
const globalForDb = globalThis as unknown as {
  __posClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__posClient ??
  postgres(url, {
    // Supabase's transaction pooler (port 6543) doesn't support prepared
    // statements — this must be false or you get random "prepared statement
    // already exists" errors.
    prepare: false,
    max: 1,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__posClient = client;
}

export const db = drizzle(client, { schema });
