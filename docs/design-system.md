# Design System — "Kopitiam After Dark" (locked 2026-07-31)

The visual + interaction system for the POS UI, approved from an interactive
prototype. **Visual reference:** [`docs/design-mock.html`](design-mock.html) —
open it in a browser to see exact layout, spacing, and the interactions.
(Published Artifact snapshot: https://claude.ai/code/artifact/d2550de3-d494-435c-9364-8237e213494b)

Committed **dark theme only** — the stall runs in a dim environment, so there is
no light mode (a deliberate single-world choice, not an omission).

## Tokens (define as Tailwind v4 CSS vars / `@theme`)

```
--bg:#17110E        warm espresso near-black (app ground)
--surface:#221913   raised tile / panel
--surface-2:#2C211A hover / higher elevation
--key-lip:#0B0806   hard bottom edge of tactile keys (depth)
--ink:#F0E7D5       primary text (warm paper)
--ink-dim:#B7A88E   secondary text
--ink-faint:#7A6E5C faint labels
--jade:#37A88C      PRIMARY accent — Place Order, totals, active state
--jade-deep:#22735F jade pressed / key lip
--marigold:#EDB24E  highlight — money totals, UNPAID, attention
--hairline:#382B22  dividers, partitions
--brick:#C8593B     destructive only (clear/void/remove) — never an accent
category dots: coffee #C68A55 · cold #4FB6C4 · pastry #DCA750 · other #93A56B
```
Semantic color (jade=go, marigold=attention, brick=destructive) is separate from
decoration. Money is always mono + `tabular-nums`.

## Type (self-host via `next/font`)

- **Display / signage** — **Archivo** (heavy, semi-condensed): brand, nav, headings, keys, buttons. UPPERCASE + letter-spacing.
- **Body / labels** — **Hanken Grotesk**: item names, descriptions, form labels.
- **Money / numbers** — **IBM Plex Mono** (`tabular-nums`): all prices, totals, quantities, keypad.

## Signature — the tactile key

Every item tile / action button is a raised key with a hard bottom lip
(`box-shadow: 0 3px 0 var(--key-lip)`) that compresses on press
(`translateY` + shrink lip). Reads like a backlit till key. This is the one
bold move — keep everything else quiet. Respect `prefers-reduced-motion`.

## Touch rules

iPad-first landscape. Min 44px targets (keys 72px+, keypad/steppers ~56px).
Visible focus rings. The app frame never scrolls; only inner regions (item grid,
ticket lines, catalog list) scroll.

## Screens

- **Home hub** (`/`) — 3 big destination keys (Order = jade primary, largest), a live day-strip (orders / taken / stall-open). Fills the landscape; not a centered menu.
- **Order** (`/order`) — two-pane: left = category tabs (**derived dynamically from item categories — never hardcode**) + item-key grid; right = order ticket (lines with **− N + steppers** and **× remove**, subtotal, marigold **TOTAL**, jade **Place Order**). **Clear order** button has a **confirm guardrail** (not instant wipe).
- **Add / variations pop-up** — tapping **any** item opens a modal: variation groups (single-select chips, REQUIRED badges) **when present**, an **optional Note** field, and a **quantity stepper** — for *every* item, even those with no variations. Live unit×qty price. Adds a line (identical item+options+note merges & increments; differing = new line).
- **Place Order → Payment → Paid** — Place Order persists **unpaid** → "Order Placed" screen offers **[Print unpaid receipt]** or **[Make payment]** → **Payment** screen (cash keypad, tendered, change-due, Exact + quick-cash; Confirm gated until tendered ≥ total) → **Paid** screen (change due, print final receipt, new order). Non-cash tender not implemented.
- **Catalog** (`/catalog`) — deliberately **verbose**, not POS-dense (it's the editing surface): full-width item cards with category chip, editable price, Edit/Deactivate, and per-item variation groups/options with add/remove. Deactivated items archived at the bottom.
- **Reports** — deferred; placeholder only for now.

## Deferred (planned, not now)

- **Item images** — NOT on the order grid (single operator knows the menu; coffee photos don't discriminate). If added: (a) image at the top of the add pop-up, (b) thumbnail on catalog cards. `items.image_url` column already exists.

## Schema deltas this design needs (do in the relevant build phase)

- Phase 4: `order_items.note` (nullable text); order-line **option snapshot** (name + delta per chosen option) so history survives catalog edits.
- Phase 4.5: `orders` status `unpaid`→`paid` + `cash_tendered_cents`, `change_cents`, `paid_at` (already in the build plan).

## Build note

The prototype fakes navigation by toggling screens in JS. The real app uses
**App Router routes** and Server Components/Actions per the plan — same design,
real routing. Fonts in the mock are system fallbacks; self-host the real three.
