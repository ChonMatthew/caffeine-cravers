import type { ItemWithOptions } from "@/db/schema";
import { centsToInput } from "@/lib/money";

import {
  addGroupAction,
  addOptionAction,
  removeGroupAction,
  removeOptionAction,
  toggleOptionActiveAction,
} from "./actions";

// "+2.00" / "-1.00" — the option price delta, mono, in the design's compact form.
function deltaLabel(cents: number): string {
  return `${cents < 0 ? "−" : "+"}${centsToInput(Math.abs(cents))}`;
}

// Server component: an item's option groups + options, plus the plain form
// actions to manage them. No client state — every control is a tiny POST that
// revalidates /catalog. Touch targets are 44px (was the compact-link tech debt).
export function Variations({ item }: { item: ItemWithOptions }) {
  return (
    <div className="ic-vars">
      <div className="ic-vars-lbl">Variations</div>

      {item.optionGroups.length === 0 && (
        <p className="novar">No variations yet.</p>
      )}

      {item.optionGroups.map((group) => (
        <div className="cgrp" key={group.id}>
          <div className="cgrp-lbl">
            {group.name}
            {group.required && <span className="req">REQ</span>}
          </div>

          <div className="opts">
            {group.options.map((opt) => (
              <span
                key={opt.id}
                className={`opt${opt.isActive ? "" : " hidden-opt"}`}
              >
                {opt.name}
                <span className="dp">{deltaLabel(opt.priceDeltaCents)}</span>
                <form action={toggleOptionActiveAction}>
                  <input type="hidden" name="optionId" value={opt.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={opt.isActive ? "false" : "true"}
                  />
                  <button
                    className="toggle"
                    title={opt.isActive ? "Hide from order screen" : "Show"}
                  >
                    {opt.isActive ? "Hide" : "Show"}
                  </button>
                </form>
                <form action={removeOptionAction}>
                  <input type="hidden" name="optionId" value={opt.id} />
                  <button className="x" title="Remove option" aria-label="Remove option">
                    ×
                  </button>
                </form>
              </span>
            ))}

            {/* inline add-option */}
            <form action={addOptionAction} className="opt-add">
              <input type="hidden" name="groupId" value={group.id} />
              <input
                name="name"
                required
                maxLength={40}
                placeholder="Option"
                className="field sm"
                style={{ width: 120 }}
              />
              <input
                name="price"
                inputMode="decimal"
                placeholder="+0.00"
                className="field sm money"
              />
              <button className="dashbtn">+ option</button>
            </form>
          </div>

          <form action={removeGroupAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <button className="mini danger">Remove {group.name}</button>
          </form>
        </div>
      ))}

      {/* add a new group */}
      <form action={addGroupAction} className="grp-add">
        <input type="hidden" name="itemId" value={item.id} />
        <input
          name="name"
          required
          maxLength={40}
          placeholder="New group (e.g. Size)"
          className="field sm"
        />
        <label className="checkbox-lbl">
          <input type="checkbox" name="required" defaultChecked /> required
        </label>
        <button className="dashbtn">+ Add group</button>
      </form>
    </div>
  );
}
