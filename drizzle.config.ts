import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The Next.js app auto-loads .env.local, but standalone CLIs (drizzle-kit) do
// not — so load it here for `db:generate` / `db:migrate`.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts", // source of truth for the tables
  out: "./drizzle", // generated SQL migrations land here (committed to git)
  dialect: "postgresql",
  dbCredentials: {
    // Only used when connecting (migrate/push/studio). `generate` works offline.
    url: process.env.DATABASE_URL ?? "",
  },
});
