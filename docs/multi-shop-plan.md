# Multi-shop plan — Bukit Tinggi + Cheras

Status: **planned, not started.** No code has changed for this yet.

## Decisions (locked 2026-10-05)

- Two shops, fixed: **Bukit Tinggi** (shop #1, owns all existing data) and
  **Cheras** (shop #2, starts empty).
- Same business, one operator, **one iPad**. The shops are **never open at the
  same time**.
- Each shop has its **own catalog** (items + prices). No shared items, no
  per-shop price overrides, no "copy to other shop" button.
- **Hard divide:** while logged in to one shop you see nothing from the
  other: no catalog, orders, Recent, reports or CSV. There is no "all shops" view.
- **Login:** one PIN (today's `POS_PIN_HASH`) plus a **shop picker** on the
  login screen. The chosen shop goes in the signed session. To switch shops,
  press Lock and log in again with the other shop.
- **Receipt:** the shop name prints as a banner on the **customer copy only**.
  Barista FOOD/DRINKS tickets are unchanged.
- Daily order numbers ("Order #12 today") are counted **per shop**.

## 1. Schema + migration

`src/db/schema.ts`:

- New `shops` table: `id text primary key` (slug: `bukit-tinggi`, `cheras`)
  and `name text not null`. Slug ids keep the backfill, the JWT claim and
  debugging readable. Never rename a slug; `name` is the display text.
- `items.shop_id text not null references shops(id)`.
- `orders.shop_id text not null references shops(id)`, plus an index on
  `(shop_id, created_at)` (all report queries filter on both).
- `option_groups`, `options`, `order_items`: **no change**. Groups and options
  inherit their shop through their item, and order lines through their order.
- Relations: `shops` has many `items` and `orders`.

Migration (one file in `drizzle/`):

1. `drizzle-kit generate` emits `ADD COLUMN shop_id ... NOT NULL`, which fails
   on tables that already have rows. Edit the generated SQL, in the same
   committed migration (not out of band), to:
   create `shops` → insert both rows → add `shop_id` as nullable →
   `UPDATE items/orders SET shop_id = 'bukit-tinggi'` → `SET NOT NULL` →
   add the FK and index.
2. Run it against the dev DB first and confirm the row counts are unchanged.

## 2. Auth + session

- `src/lib/session.ts`: `signSessionToken(shopId)` puts `shopId` in the JWT.
  `verifySessionToken` returns the shop id (or `null`) instead of a boolean.
  A token **without** `shopId` counts as invalid, so after deploy the
  iPad is logged out once and the operator picks a shop. This is expected.
- `src/lib/dal.ts`: `requireSession()` returns `{ shopId }`. This is the
  only place the shop comes from. Never take a shop id from client input.
- `src/app/login/`: the page shows two big shop buttons above the keypad, with
  **no default selection**, so the choice is a deliberate tap every login.
  `login` validates `shopId` against the `shops` table and keeps the
  300ms delay.
- `src/proxy.ts`: no logic change (it still only asks "valid token?").
- Lock (`logout`) is unchanged. It is the "switch shop" action.

## 3. DAL scoping (`src/lib/dal.ts`)

Every function scopes by `requireSession().shopId`:

- **Catalog reads:** `getAllItems`, `getActiveItems`, `getCatalog` and
  `getActiveItemsWithOptions` filter `items.shop_id`.
- **Catalog writes:** `createItem` sets `shop_id`. `updateItem` and
  `setItemActive` add `AND shop_id = ?`. The option-group and option mutations
  (`createOptionGroup`, `deleteOptionGroup`, `setGroupRequired`,
  `createOption`, `deleteOption`, `setOptionActive`) check that the parent
  item belongs to the shop (join or subquery). This stops a stale form posting
  into the other shop's catalog.
- **Orders:** `createOrder` sets `shop_id`. `getOrderById`, `replaceOrderLines`
  and `markOrderPaid` add `AND shop_id = ?`, so `/order/<id>` from the other
  shop returns not-found and can't be edited or paid.
- **Daily number:** the per-day count in `getOrderById`, `getRecentOrders` and
  `getOrdersForDay` adds `o2.shop_id = orders.shop_id` (same qualified-outer-
  column trick the existing NOTE comments describe).
- **Lists and reports:** `getRecentOrders`, `getTodaySummary`, `getDailySales`,
  `getItemBreakdown`, `getReportSummary`, `getHourlyBreakdown` and
  `getOrdersForDay` filter `orders.shop_id`.
- New `getCurrentShop()` returns `{ id, name }` for the header, receipt and
  report title.

`placeOrder` and `editOrder` need no extra check: they reprice from
`getActiveItemsWithOptions()`, which is already shop-scoped, so an item
from the other shop fails as "no longer available".

## 4. UI

- **Header** (`pos-shell.tsx`): show the current shop name next to the
  brand, always visible. This is the main guard against trading a day under
  the wrong shop, because the session lasts 30 days.
- **Home** (`(pos)/page.tsx`): the day strip is shop-scoped automatically. Add
  the shop name to the heading.
- **Customer copy** (`lib/receipt.ts`): `CustomerReceiptData` gains
  `shopName`, printed as the first line (centered or plain, within 32 cols,
  ASCII). `order-actions.tsx` passes it in. Barista tickets are untouched.
- **Reports + export:** the report page title and `report-text.ts` header
  include the shop name ("CAFFEINE CRAVERS — CHERAS — SALES REPORT"), and the
  export filename includes the slug (`report-cheras-2026-10-05.txt`).

## 5. Seed

`src/db/seed.ts` upserts both shop rows and seeds the existing menu into
**Bukit Tinggi** only. The operator enters Cheras's menu through the
Catalog screen while logged in as Cheras.

## 6. Tests (Vitest, pure only)

- `receipt.test.ts`: the customer copy prints the shop name and stays within
  32 cols. The barista-ticket tests stay as they are.
- `report-text.test.ts`: the header includes the shop name.
- No tests for the DAL, actions or login (CLAUDE.md testing rule). Verify
  scoping by hand: log in to each shop, place an order, and confirm it's
  absent from the other shop's Recent and Report, and that its `/order/<id>`
  URL is not found from the other shop.

## 7. Rollout

1. Branch for this phase. `tsc --noEmit`, ESLint, tests and build must be
   green before merging to `main`.
2. Apply the migration to the prod DB **before** the deploy that reads
   `shop_id` goes live.
3. After deploy the iPad is logged out once. Log in and pick Bukit Tinggi.
4. No env var changes. `POS_PIN_HASH` and `SESSION_SECRET` stay as they are.

## Open / noted

- **Ref # (`order_seq`) stays global** across both shops, so each shop's
  receipts show gaps in Ref #. Daily numbers are per shop and gapless. This is
  fine for now; a per-shop record number would need a stored counter.
- Cheras's menu: does the operator have it ready to enter after deploy?
