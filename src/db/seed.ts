import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { eq } from "drizzle-orm";

import { items, optionGroups, options, shops } from "./schema";

// Standalone script: load env ourselves (Next isn't running here).
config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

// Destructive: wipes and reseeds Bukit Tinggi's catalog. Guarded so it can't fire by
// accident — run with `--force` (npm run db:seed -- --force).
if (!process.argv.includes("--force")) {
  console.error(
    "Refusing to wipe + reseed the catalog without --force.\n" +
      "Run: npm run db:seed -- --force",
  );
  process.exit(1);
}

// The menu below is Bukit Tinggi's. Cheras starts with an empty catalog (filled
// in via the Catalog screen while logged in as Cheras) — the seed never touches
// Cheras's items.
const SEED_SHOP = "bukit-tinggi";

// The real Caffeine Cravers menu (from the printed board), modeled per best
// practice for this system: each row is its own item. Hot drinks and single-
// size drinks are flat-priced with NO variation. Iced drinks that come in two
// sizes carry a required "Size" variation (Small = base, Large = +delta) — the
// only place an option group earns its keep. Prices in whole cents (MYR).
type SeedItem = {
  name: string;
  category: string;
  smallCents: number; // base price (the only price when there's no Large)
  largeCents?: number; // present only for genuine two-size drinks
};

const MENU: SeedItem[] = [
  // --- Hot Coffee (single size, flat price) ---
  { name: "Double Espresso", category: "Hot Coffee", smallCents: 500 },
  { name: "Americano", category: "Hot Coffee", smallCents: 500 },
  { name: "Caffe Latte", category: "Hot Coffee", smallCents: 600 },
  { name: "Cappuccino", category: "Hot Coffee", smallCents: 700 },
  { name: "Spanish Latte", category: "Hot Coffee", smallCents: 800 },
  { name: "Caramel Latte", category: "Hot Coffee", smallCents: 800 },

  // --- Iced Coffee (S / L, except the single-size Affogato) ---
  { name: "D'Ora Affogato", category: "Iced Coffee", smallCents: 900 },
  { name: "Iced Americano", category: "Iced Coffee", smallCents: 600, largeCents: 800 },
  { name: "Iced Cappuccino", category: "Iced Coffee", smallCents: 800, largeCents: 1000 },
  { name: "Iced Latte", category: "Iced Coffee", smallCents: 800, largeCents: 1000 },
  { name: "Iced Spanish Latte", category: "Iced Coffee", smallCents: 900, largeCents: 1100 },
  { name: "Iced Palm Sugar", category: "Iced Coffee", smallCents: 900, largeCents: 1200 },
  { name: "Ice Mocha", category: "Iced Coffee", smallCents: 1000, largeCents: 1200 },
  { name: "Iced Caramel Latte", category: "Iced Coffee", smallCents: 1000, largeCents: 1300 },

  // --- Non Coffee ---
  { name: "Iced Chocolate", category: "Non Coffee", smallCents: 900, largeCents: 1200 },
  { name: "Thai Lime Soda", category: "Non Coffee", smallCents: 1000 },
  { name: "Blackcurrant Lychee Blast", category: "Non Coffee", smallCents: 1000 },
];

async function main() {
  const client = postgres(url!, { prepare: false });
  const db = drizzle(client);
  try {
    // The two fixed shops (the migration inserts them too; this makes a fresh
    // DB seedable on its own). Never overwrites an existing row.
    await db
      .insert(shops)
      .values([
        { id: "bukit-tinggi", name: "Bukit Tinggi", refPrefix: "BT" },
        { id: "cheras", name: "Cheras", refPrefix: "CH" },
      ])
      .onConflictDoNothing();

    // Deleting items cascades to their option groups + options. Past orders are
    // untouched (order lines snapshot name/price; item_id is set null). Only
    // Bukit Tinggi's catalog is wiped — never Cheras's.
    await db.delete(items).where(eq(items.shopId, SEED_SHOP));

    let itemCount = 0;
    let sizeGroups = 0;
    for (const m of MENU) {
      const [item] = await db
        .insert(items)
        .values({
          shopId: SEED_SHOP,
          name: m.name,
          priceCents: m.smallCents,
          category: m.category,
        })
        .returning({ id: items.id });
      itemCount++;

      if (m.largeCents !== undefined) {
        const [group] = await db
          .insert(optionGroups)
          .values({ itemId: item.id, name: "Size", required: true, sortOrder: 0 })
          .returning({ id: optionGroups.id });
        await db.insert(options).values([
          { groupId: group.id, name: "Small", priceDeltaCents: 0, sortOrder: 0 },
          {
            groupId: group.id,
            name: "Large",
            priceDeltaCents: m.largeCents - m.smallCents,
            sortOrder: 1,
          },
        ]);
        sizeGroups++;
      }
    }
    console.log(
      `Seeded ${itemCount} Bukit Tinggi items (${sizeGroups} with a Size variation).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
