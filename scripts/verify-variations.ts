// TEMP verification for Phase 3.5 — delete after running.
// Proves: new tables accept writes, the relational nested read works, the FK
// cascade cleans up, and resolveUnitPrice matches the plan example.
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { items, optionGroups, options } from "../src/db/schema";
import * as schema from "../src/db/schema";
import { resolveUnitPrice } from "../src/lib/order";

config({ path: ".env.local" });
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

async function main() {
  const client = postgres(url!, { prepare: false });
  const db = drizzle(client, { schema });
  try {
    const [item] = await db
      .insert(items)
      .values({ name: "ZZ Verify Latte", priceCents: 800, category: "Test" })
      .returning();
    const [size] = await db
      .insert(optionGroups)
      .values({ itemId: item.id, name: "Size", required: true })
      .returning();
    const [temp] = await db
      .insert(optionGroups)
      .values({ itemId: item.id, name: "Temp", required: true })
      .returning();
    await db.insert(options).values([
      { groupId: size.id, name: "Small", priceDeltaCents: 0 },
      { groupId: size.id, name: "Large", priceDeltaCents: 200 },
      { groupId: temp.id, name: "Hot", priceDeltaCents: 0 },
      { groupId: temp.id, name: "Iced", priceDeltaCents: 100 },
    ]);

    // Exactly the shape getCatalog() returns, scoped to our test item.
    const nested = await db.query.items.findMany({
      where: (i, { eq }) => eq(i.id, item.id),
      with: {
        optionGroups: {
          orderBy: (g, { asc }) => asc(g.name),
          with: { options: { orderBy: (o, { asc }) => asc(o.name) } },
        },
      },
    });
    console.log("NESTED READ:");
    for (const g of nested[0].optionGroups) {
      console.log(
        `  ${g.name}${g.required ? " (required)" : ""}: ` +
          g.options.map((o) => `${o.name}+${o.priceDeltaCents}`).join(", "),
      );
    }

    const big = nested[0].optionGroups.find((g) => g.name === "Size")!;
    const large = big.options.find((o) => o.name === "Large")!;
    const cold = nested[0].optionGroups.find((g) => g.name === "Temp")!;
    const iced = cold.options.find((o) => o.name === "Iced")!;
    const unit = resolveUnitPrice(nested[0].priceCents, [
      { groupId: large.groupId, optionId: large.id, name: large.name, priceDeltaCents: large.priceDeltaCents },
      { groupId: iced.groupId, optionId: iced.id, name: iced.name, priceDeltaCents: iced.priceDeltaCents },
    ]);
    console.log(`PRICE Latte+Large+Iced = ${unit} ${unit === 1100 ? "OK" : "WRONG"}`);

    await db.delete(items).where(eq(items.id, item.id));
    const after = await db.query.optionGroups.findMany({
      where: (g, { eq }) => eq(g.itemId, item.id),
    });
    console.log(`CASCADE cleanup: groups left = ${after.length} ${after.length === 0 ? "OK" : "LEAK"}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
