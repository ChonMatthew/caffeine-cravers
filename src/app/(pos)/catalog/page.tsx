import type { ItemWithOptions } from "@/db/schema";
import { getCatalog } from "@/lib/dal";
import { formatCents } from "@/lib/money";

import { toggleItemActiveAction } from "./actions";
import { ItemForm } from "./item-form";
import { Variations } from "./variations";

// Category colours, assigned dynamically to whatever categories exist (never
// hardcoded to a fixed menu) — same four-swatch cycle as the order screen.
const CAT_VARS = ["--cat-coffee", "--cat-cold", "--cat-pastry", "--cat-other"];
const UNCATEGORISED = "Other";

function ActiveToggle({ item }: { item: ItemWithOptions }) {
  return (
    <form action={toggleItemActiveAction}>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="active" value={item.isActive ? "false" : "true"} />
      <button className={`mini${item.isActive ? " danger" : " primary"}`}>
        {item.isActive ? "Deactivate" : "Reactivate"}
      </button>
    </form>
  );
}

export default async function CatalogPage() {
  const items = await getCatalog();
  const active = items.filter((i) => i.isActive);
  const deactivated = items.filter((i) => !i.isActive);

  // Stable colour per distinct category (across all items, so active + archived
  // agree on a colour).
  const cats: string[] = [];
  for (const i of items) {
    const c = i.category ?? UNCATEGORISED;
    if (!cats.includes(c)) cats.push(c);
  }
  const colorVar = (cat: string | null) =>
    `var(${CAT_VARS[Math.max(0, cats.indexOf(cat ?? UNCATEGORISED)) % CAT_VARS.length]})`;

  return (
    <main className="catalog">
      <div className="cat-head">
        <h1>Catalog</h1>
        <span className="count">{active.length} active</span>
      </div>
      <p className="cat-sub">
        Add, edit, and price items and their variations. Deactivated items drop
        to the archive at the bottom (never deleted, so past sales stay intact).
      </p>

      {/* add a new item */}
      <div className="itemcard add">
        <ItemForm />
      </div>

      {/* active items — the full editing surface */}
      {active.map((item) => (
        <div className="itemcard" key={item.id}>
          <div className="ic-top">
            <span
              className="ic-dot"
              style={{ background: colorVar(item.category) }}
              aria-hidden
            />
            <ItemForm item={item} />
            <div className="ic-actions">
              <ActiveToggle item={item} />
            </div>
          </div>
          <Variations item={item} />
        </div>
      ))}

      {active.length === 0 && (
        <p className="novar">No active items yet — add one above.</p>
      )}

      {/* deactivated archive — read-only, reactivatable */}
      {deactivated.length > 0 && (
        <div className="cat-arch">
          <h2>Deactivated ({deactivated.length})</h2>
          {deactivated.map((item) => (
            <div className="arch-row" key={item.id}>
              <span
                className="ic-dot"
                style={{ background: colorVar(item.category) }}
                aria-hidden
              />
              <span className="ic-name">{item.name}</span>
              {item.category && (
                <span
                  className="chip-cat"
                  style={{ borderColor: colorVar(item.category), color: colorVar(item.category) }}
                >
                  {item.category}
                </span>
              )}
              <span className="arch-price">{formatCents(item.priceCents)}</span>
              <ActiveToggle item={item} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
