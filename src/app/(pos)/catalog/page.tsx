import { getCatalog } from "@/lib/dal";
import { formatCents } from "@/lib/money";

import { toggleItemActiveAction } from "./actions";
import { ItemForm } from "./item-form";
import { Variations } from "./variations";

export default async function CatalogPage() {
  const items = await getCatalog();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">Catalog</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground/70">Add item</h2>
        <ItemForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground/70">
          Items ({items.length})
        </h2>

        {items.map((item) => (
          <div
            key={item.id}
            className={`flex flex-wrap items-center gap-3 rounded-lg border border-foreground/10 p-3 ${
              item.isActive ? "" : "opacity-50"
            }`}
          >
            <ItemForm item={item} />
            <span className="text-sm text-foreground/60">
              {formatCents(item.priceCents)}
            </span>
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

            <Variations item={item} />
          </div>
        ))}
      </section>
    </main>
  );
}
