import type { ItemWithOptions } from "@/db/schema";
import { formatCents } from "@/lib/money";

import {
  addGroupAction,
  addOptionAction,
  removeGroupAction,
  removeOptionAction,
  toggleOptionActiveAction,
} from "./actions";

// Server component: renders an item's option groups + options and the plain
// form actions to manage them. No client state — every button is a tiny POST
// that revalidates /catalog.
export function Variations({ item }: { item: ItemWithOptions }) {
  return (
    <div className="mt-2 w-full border-t border-foreground/10 pt-2">
      <p className="mb-2 text-xs font-medium text-foreground/50">Variations</p>

      <div className="flex flex-col gap-3">
        {item.optionGroups.map((group) => (
          <div
            key={group.id}
            className="rounded-md border border-foreground/10 p-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{group.name}</span>
              {group.required && (
                <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] uppercase text-foreground/60">
                  required
                </span>
              )}
              <form action={removeGroupAction} className="ml-auto">
                <input type="hidden" name="groupId" value={group.id} />
                <button className="text-xs text-red-600 underline">
                  Remove group
                </button>
              </form>
            </div>

            <ul className="mt-2 flex flex-col gap-1">
              {group.options.map((opt) => (
                <li
                  key={opt.id}
                  className={`flex items-center gap-2 text-sm ${
                    opt.isActive ? "" : "opacity-50"
                  }`}
                >
                  <span>{opt.name}</span>
                  <span className="text-foreground/50">
                    +{formatCents(opt.priceDeltaCents)}
                  </span>
                  <form action={toggleOptionActiveAction} className="ml-auto">
                    <input type="hidden" name="optionId" value={opt.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={opt.isActive ? "false" : "true"}
                    />
                    <button className="text-xs text-foreground/60 underline">
                      {opt.isActive ? "Hide" : "Show"}
                    </button>
                  </form>
                  <form action={removeOptionAction}>
                    <input type="hidden" name="optionId" value={opt.id} />
                    <button className="text-xs text-red-600 underline">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
              {group.options.length === 0 && (
                <li className="text-xs text-foreground/40">No options yet.</li>
              )}
            </ul>

            <form
              action={addOptionAction}
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="groupId" value={group.id} />
              <input
                name="name"
                required
                maxLength={40}
                placeholder="Option (e.g. Large)"
                className="min-h-9 rounded-md border border-foreground/20 px-2 text-sm"
              />
              <input
                name="price"
                inputMode="decimal"
                placeholder="+0.00"
                className="min-h-9 w-20 rounded-md border border-foreground/20 px-2 text-sm"
              />
              <button className="min-h-9 rounded-md border border-foreground/20 px-3 text-sm">
                Add option
              </button>
            </form>
          </div>
        ))}
      </div>

      <form
        action={addGroupAction}
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="itemId" value={item.id} />
        <input
          name="name"
          required
          maxLength={40}
          placeholder="New group (e.g. Size)"
          className="min-h-9 rounded-md border border-foreground/20 px-2 text-sm"
        />
        <label className="flex items-center gap-1 text-xs text-foreground/60">
          <input type="checkbox" name="required" defaultChecked />
          required
        </label>
        <button className="min-h-9 rounded-md border border-foreground/20 px-3 text-sm">
          Add group
        </button>
      </form>
    </div>
  );
}
