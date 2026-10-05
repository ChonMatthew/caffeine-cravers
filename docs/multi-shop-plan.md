# Multi-shop plan — Bukit Tinggi + Cheras

Status: **built** (`claude/bold-lovelace-6pgbm9`, PR #1). Green on tsc, ESLint,
tests and build, and verified end to end against a local Postgres. **Not yet
applied** to the dev or prod DB (see §7).

Implementation notes beyond the plan below:
- Carts persist in localStorage **per shop** (`cc-cart-v1:<shopId>`), so a
  half-built ticket stays with its shop across a switch. A cart saved under
  the old single key before deploy is dropped once.
- Also added an `items(shop_id)` index (every catalog read filters on it).
- The login page calls `connection()` so it renders per request and isn't
  prerendered at build (it now reads `shops`).
- Below 1280px the "Caffeine Cravers" wordmark hides (logo and shop tag stay).
  Otherwise the shop tag pushed Report out of the nav at iPad-landscape width.

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
- **Ref # is per shop and prefixed:** `BT-1, BT-2…` (Bukit Tinggi) and
  `CH-1, CH-2…` (Cheras). Each series has no gaps, and the prefix makes every
  Ref # unique across both shops.
- **Cheras's catalog starts empty.** The seed doesn't touch it.

## 1. Schema + migration

`src/db/schema.ts`:

- New `shops` table: `id text primary key` (slug: `bukit-tinggi`, `cheras`),
  `name text not null`, and `ref_prefix text not null unique` (`BT`, `CH`).
  Slug ids keep the backfill, the JWT claim and debugging readable. Never
  rename a slug or a prefix; `name` is the display text.
- `items.shop_id text not null references shops(id)`.
- `orders.shop_id text not null references shops(id)`, plus an index on
  `(shop_id, created_at)` (all report queries filter on both).
- `orders.ref_no integer not null` is the per-shop Ref # number, with
  `UNIQUE (shop_id, ref_no)`. It's printed as `<prefix>-<ref_no>` (`BT-12`).
  This UNIQUE constraint is the guarantee; the app never reuses a number.
- `orders.order_seq` stays as an **internal** identity column. It's never
  printed or shown again; everything user-facing uses `ref_no`.
- `option_groups`, `options`, `order_items`: **no change**. Groups and options
  inherit their shop through their item, and order lines through their order.
- Relations: `shops` has many `items` and `orders`.

Migration (one file in `drizzle/`):

1. `drizzle-kit generate` emits `ADD COLUMN shop_id ... NOT NULL`, which fails
   on tables that already have rows. Edit the generated SQL, in the same
   committed migration (not out of band), to:
   create `shops` → insert both rows → add `shop_id` and `ref_no` as
   nullable → `UPDATE items/orders SET shop_id = 'bukit-tinggi'` →
   renumber existing orders `ref_no = row_number() over (order by order_seq)`
   (old orders become BT-1…BT-N with no gaps) → `SET NOT NULL` → add the FKs,
   the index and `UNIQUE (shop_id, ref_no)`.
   **Decided: renumber.** Old printed tickets showed `Ref #<order_seq>`, and
   those numbers deliberately no longer match. Having no gaps wins.
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
- **Ref # assignment** (`createOrder`, inside its existing transaction): the
  insert sets `ref_no = (select coalesce(max(ref_no), 0) + 1 from orders
  where shop_id = $shop)` in the same statement. There's no separate counter
  to bump, so an idempotent retry (`onConflictDoNothing`) uses up no number
  and leaves no gap. With one iPad there are no real concurrent inserts.
  If two ever raced, `UNIQUE (shop_id, ref_no)` rejects the second rather
  than duplicating a number. `replaceOrderLines` never touches `ref_no`.
- **Daily number:** the per-day count in `getOrderById`, `getRecentOrders` and
  `getOrdersForDay` adds `o2.shop_id = orders.shop_id` and compares `ref_no`
  instead of `order_seq` (same qualified-outer-column trick the existing NOTE
  comments describe). `getOrdersForDay` orders by `ref_no`.
- Order reads return the formatted Ref # (`BT-12`) by joining `shops`, or
  the pages format it from `ref_prefix` + `ref_no`.
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
  ASCII). `order-actions.tsx` passes it in. Barista tickets get no shop name.
- **Ref # on paper and screen:** `recordNumber: number` becomes
  `refLabel: string` (`"BT-12"`) in both `ReceiptData` and
  `CustomerReceiptData`, so **both** tickets print `Ref #BT-12`. The order
  detail page's `record #…` shows the same label. `Order #12  Ref #BT-123`
  fits within 32 columns.
- **Reports + export:** the report page title and `report-text.ts` header
  include the shop name ("CAFFEINE CRAVERS — CHERAS — SALES REPORT"), and the
  export filename includes the slug (`report-cheras-2026-10-05.txt`).

## 5. Seed

`src/db/seed.ts` upserts both shop rows and seeds the existing menu into
**Bukit Tinggi** only. It wipes and reseeds Bukit Tinggi's items only, never
Cheras's. **Cheras starts with an empty catalog.** The operator fills it
later through the Catalog screen while logged in as Cheras.

## 6. Tests (Vitest, pure only)

- `receipt.test.ts`: the customer copy prints the shop name and stays within
  32 cols. Both tickets print `Ref #BT-…` (the barista snapshot changes only
  on that line, still with no prices and no shop name).
- A pure `formatRef(prefix, refNo)` helper (e.g. in `lib/order.ts`) with a
  unit test, so the `BT-12` format lives in one place.
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

- Nothing open. Existing orders are renumbered to BT-1…BT-N (decided
  2026-10-05; old paper Ref #s won't match).
