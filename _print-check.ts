import { config } from "dotenv";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { SignJWT } from "jose";
import { orderItems, orders } from "./src/db/schema";
import * as schema from "./src/db/schema";

config({ path: ".env.local" });
const BASE = "http://localhost:3000";
const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

async function cookie() {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
  const token = await new SignJWT({ role: "operator" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret);
  return `pos_session=${token}`;
}
async function seed(status: "unpaid" | "paid") {
  const [o] = await db.insert(orders).values({
    status, totalCents: 700, tableLabel: "5", idempotencyKey: crypto.randomUUID(),
    ...(status === "paid" ? { cashTenderedCents: 1000, changeCents: 300, paidAt: new Date() } : {}),
  }).returning({ id: orders.id });
  await db.insert(orderItems).values({
    orderId: o.id, itemName: "Cappuccino", unitPriceCents: 700, quantity: 1, note: null, optionsSnapshot: [],
  });
  return o.id;
}
async function get(id: string, c: string) {
  return (await (await fetch(`${BASE}/order/${id}`, { headers: { cookie: c }, redirect: "manual" })).text())
    .replace(/<!--.*?-->/g, "");
}

async function main() {
  const c = await cookie();
  const u = await seed("unpaid");
  const p = await seed("paid");
  try {
    const uh = await get(u, c);
    const ph = await get(p, c);
    console.log("UNPAID page:",
      "Print unpaid receipt=" + uh.includes("Print unpaid receipt"),
      "Make payment=" + uh.includes("Make payment"),
      "no 'Phase 5' stub=" + !uh.includes("Phase 5"));
    console.log("PAID page:",
      "Print receipt=" + ph.includes("Print receipt"),
      "New order=" + ph.includes("New order"),
      "Change due=" + ph.includes("Change due"));
    const pass = uh.includes("Print unpaid receipt") && uh.includes("Make payment") &&
      !uh.includes("Phase 5") && ph.includes("Print receipt") && ph.includes("New order");
    console.log(pass ? "PASS ✅ (real print buttons wired, stubs gone)" : "FAIL ❌");
  } finally {
    await db.delete(orders).where(inArray(orders.id, [u, p]));
    console.log("cleaned up");
  }
  await client.end();
}
main().catch(async (e) => { console.error(e); await client.end(); process.exit(1); });
