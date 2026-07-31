import type { ItemWithOptions } from "@/db/schema";
import { getCatalog } from "@/lib/dal";
import { formatCents } from "@/lib/money";

import { toggleItemActiveAction } from "./actions";
import { ItemForm } from "./item-form";
import { Variations } from "./variations";

// The activate/deactivate toggle — shared by both sections.
function ActiveToggle({ item }: { item: ItemWithOptions }) {
  return (
    <form action={toggleItemActiveAction} className="ml-auto">
      <input type="hidden" name="id" value={item.id} />
      <input
        type="hidden"
        name="active"
        value={item.isActive ? "false" : "true"}
      />
      <button className="min-h-11 rounded-md border border-foreground/20 px-3 text-sm">
        {item.isActive ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}

export default async function CatalogPage() {
  const items = await getCatalog();
  // Active items get the full editor; deactivated ones drop to a tidy archive
  // at the bottom so they don't clutter the working list.
  const active = items.filter((i) => i.isActive);
  const deactivated = items.filter((i) => !i.isActive);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">Catalog</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/70">Add item</h2>
        <ItemForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground/70">
          Active items ({active.length})
        </h2>

        {active.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-foreground/10 p-3"
          >
            <ItemForm item={item} />
            <span className="text-sm text-foreground/60">
              {formatCents(item.priceCents)}
            </span>
            <ActiveToggle item={item} />
            <Variations item={item} />
          </div>
        ))}

        {active.length === 0 && (
          <p className="text-sm text-foreground/40">No active items yet.</p>
        )}
      </section>

      {deactivated.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-foreground/10 pt-4">
          <h2 className="text-sm font-medium text-foreground/50">
            Deactivated ({deactivated.length})
          </h2>

          {deactivated.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-foreground/10 p-3 opacity-60"
            >
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-sm text-foreground/60">
                {formatCents(item.priceCents)}
              </span>
              <ActiveToggle item={item} />
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
