// Wipe all order history so the POS can start fresh, without touching the
// catalog (items / option_groups / options).
// Usage:  npm run db:reset-orders -- --force
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { orders } from "../src/db/schema";

// Standalone script: load env ourselves (Next isn't running here).
config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

// Destructive: deletes every order. Guarded so it can't fire by accident —
// run with `--force` (npm run db:reset-orders -- --force).
if (!process.argv.includes("--force")) {
  console.error(
    "Refusing to delete all orders without --force.\n" +
      "Run: npm run db:reset-orders -- --force",
  );
  process.exit(1);
}

async function main() {
  const client = postgres(url!, { prepare: false });
  const db = drizzle(client);
  try {
    // order_items references orders with onDelete: "cascade", so deleting an
    // order removes its lines too. Nothing in the catalog (items,
    // option_groups, options) references orders, so it's untouched.
    const deleted = await db.delete(orders).returning({ id: orders.id });
    console.log(`Deleted ${deleted.length} order(s) and their line items. Catalog left untouched.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
