import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { items, type NewItem } from "./schema";

// Standalone script: load env ourselves (Next isn't running here).
config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

// Prices in whole cents (MYR). ASCII names (thermal-printer friendly).
const menu: NewItem[] = [
  { name: "Espresso", priceCents: 550, category: "Coffee" },
  { name: "Americano", priceCents: 650, category: "Coffee" },
  { name: "Latte", priceCents: 800, category: "Coffee" },
  { name: "Cappuccino", priceCents: 800, category: "Coffee" },
  { name: "Flat White", priceCents: 850, category: "Coffee" },
  { name: "Mocha", priceCents: 900, category: "Coffee" },
  { name: "Iced Latte", priceCents: 900, category: "Cold" },
  { name: "Iced Americano", priceCents: 750, category: "Cold" },
  { name: "Hot Chocolate", priceCents: 750, category: "Other" },
  { name: "Croissant", priceCents: 500, category: "Pastry" },
  { name: "Muffin", priceCents: 450, category: "Pastry" },
];

async function main() {
  const client = postgres(url!, { prepare: false });
  const db = drizzle(client);
  try {
    // Reset so re-running the seed doesn't pile up duplicates.
    await db.delete(items);
    const inserted = await db.insert(items).values(menu).returning();
    console.log(`Seeded ${inserted.length} items.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
