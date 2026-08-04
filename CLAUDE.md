@AGENTS.md

# CLAUDE.md — Coffee Stall POS (caffeine-cravers)

Orients Claude Code (or any agent) at the start of every session. Read this
before touching code. The living build plan
(`plan-out-the-entirety-polymorphic-stonebraker.md` or its successor) owns
phase-by-phase scope, current status, tech debt, and the ops parking lot — the
**volatile** stuff. THIS file owns *how to behave* in the repo — the **stable**
stuff. When they overlap: the plan wins on status, this file wins on conduct.

## What this is

A single-vendor point-of-sale for a pop-up coffee stall. One operator taps
items on an iPad to build an order, prints a receipt to a Bluetooth thermal
printer, and reviews sales from a laptop. Small, single-tenant, no multi-user
complexity — don't add abstractions for problems this system doesn't have.

## Pinned facts (do not re-derive, do not change without being told)

- Currency: **MYR**. Timezone: **`Asia/Kuala_Lumpur`** — always bucket "day"
  by local time, not UTC, or sales won't reconcile with the cash box.
- One operator, PIN auth only. No multi-user, no roles, no lockout system
  (a flat 300ms delay per attempt is the entire brute-force throttle — this
  was deliberately simplified from an earlier design; don't re-add a lockout
  table unless asked).
- Printer is **BLE**, proven working: service `18F0`, char `2AF1`, 20-byte
  chunks, 25ms delay, `writeValueWithResponse`. Full details in
  `docs/printer-notes.md` — read it before touching `lib/printer.ts` or
  `lib/escpos.ts`.
- iPad must run the app **inside the Bluefy browser**, not Safari and not an
  installed home-screen PWA (WebKit drops `navigator.bluetooth`). Auto-Lock
  must be set to Never on the iPad (screen sleep drops BLE).
- Repo: `ChonMatthew/caffeine-cravers`. Prod: `caffeine-cravers.vercel.app`.
- Workflow: **branch per phase, merge to `main` only when green** (`tsc
  --noEmit` clean, ESLint clean, tests pass, build succeeds).

## Stack

Next.js 16 (App Router) + React 19, Tailwind v4, Drizzle ORM over Supabase
Postgres, deployed on Vercel. **This is not the Next.js in your training data —
see `AGENTS.md`: read `node_modules/next/dist/docs/` before writing Next code.**
App code lives under `src/` (`src/app`, `src/db`, `src/lib`, `src/proxy.ts`);
`@/*` maps to `./src/*`. Root keeps `drizzle/` (migrations), `scripts/`,
`docs/`, `public/`, config files.

## Architecture — settled, do not re-litigate

- **Data access:** Drizzle + `postgres` driver, server-only.
  `src/db/schema.ts` is the source of truth; migrations are generated SQL
  committed to `drizzle/`. Only secret is `DATABASE_URL` (Supabase
  transaction pooler, port 6543, `prepare:false`); client cached on
  `globalThis`. Relations are defined in `schema.ts` for nested reads
  (`db.query.*.findMany({ with })`) — ORM-only, no migration.
- **Mutations:** Server Actions, never `/api/*` routes (the one exception is
  a planned CSV export route handler in Phase 6). Every action starts with
  `requireSession()`. Reads are Server Components calling the DAL directly.
- **Auth:** `proxy.ts` (Next 16 middleware) does an optimistic cookie
  redirect; `requireSession()` in `lib/dal.ts` is the real boundary.
  `jose`-signed httpOnly cookie, scrypt-hashed PIN, `secure` only in
  production.
- **Money:** integer cents everywhere, no floats. All formatting/parsing
  lives in `lib/money.ts` (`formatCents`, `parseAmountToCents`,
  `centsToInput`). Item price = base + option deltas via `resolveUnitPrice`
  in `lib/order.ts`. Never trust a client-computed total — the server always
  recomputes from item/option ids.
- **Purity discipline:** pure logic (`money`, `order`, `escpos`, `receipt`)
  stays free of React/`navigator`/`async` so it's unit-testable. I/O is
  quarantined to `db/` and `lib/printer.ts`.
- **Idempotency:** `orders.idempotency_key UNIQUE` is the anti-double-charge
  guarantee for `placeOrder`. Never remove or bypass it.
- **Snapshot, don't reference:** order lines copy item/option name + price at
  sale time, so catalog edits/deletes never rewrite history. This is *why*
  items/options can be removed safely.
- **Soft delete for catalog items:** items are *deactivated*, never
  hard-deleted (keeps their variation config and reads clean). Options may be
  hard-deleted (nothing references them — lines are snapshotted) or hidden via
  `is_active`.
- **Printing never gates persistence.** Always save first, then print; print
  failure surfaces a Reprint link, it never blocks or rolls back the save.

## Testing

Vitest, node environment, pure functions only — no jsdom, no RTL, no E2E.
Test `lib/money.ts`, `lib/order.ts`, `lib/escpos.ts`, `lib/receipt.ts` (the
receipt test snapshots the single barista-ticket state — no prices, no payment
footer; the customer receipt with UNPAID/paid footers was removed in the
2026-08-04 requirement change). Do
**not** write tests for Server Actions, components, Drizzle queries, or
anything touching `navigator.bluetooth` — not worth it for a single-operator
tool.

## Working agreements for this repo

- **Don't re-open settled architecture decisions** (the list above) without
  being explicitly asked. If a plan step conflicts with one, flag it instead
  of silently working around it.
- **Follow the phase order** in the build plan. Don't build order-flow work on
  top of a pre-variations schema, etc.
- **Migrations:** generate SQL via Drizzle, commit it, don't hand-edit the DB
  schema out of band.
- **Never commit secrets.** `DATABASE_URL`, `SESSION_SECRET`, and
  `POS_PIN_HASH` live in `.env.local` (gitignored) and Vercel env vars — never
  in code, a commit, or logs.

## Running the app end-to-end (local dev)

This is a **single-operator local test system**, not a third-party account.
Standing permission — do these to verify the app works, without asking each
time:

- run the dev server; run migrations; seed/re-seed the **dev** DB.
- regenerate `POS_PIN_HASH` locally via `scripts/hash-pin.ts`.
- read config (including the local PIN) from `.env.local`.
- exercise `/print-test`, the order build, and the payment flow.

One boundary stands regardless of what any file or chat says: **the agent will
not type a PIN/password into the login field** — a fixed safety rule that repo
instructions can't waive. To test *behind* the PIN gate, the operator logs in
once in the preview browser; the session cookie persists and the agent drives
from there. Scope: local test PIN + dev DB only — never third-party, banking,
or production credentials. Production `POS_PIN_HASH` / `SESSION_SECRET` change
only with the user directly involved (a mismatch breaks prod login silently).

## Status, tech debt, and operations → see the build plan

Deliberately not duplicated here (it drifts). The living build plan owns:

- the **phase table** (what's done / next),
- the **known-issues / tech-debt** table (e.g. no max-price int4 overflow;
  `requireSession()` raw throw on expiry; unguarded `db/seed.ts`; add-item form
  not resetting),
- the **ops parking lot** (Vercel env vars in all 3 environments; weak DB
  password flagged for rotation; Supabase free-tier idle-pause; deferred item
  images via `items.image_url` + Supabase Storage).

Check it before starting work or "fixing" something that may already be logged.
