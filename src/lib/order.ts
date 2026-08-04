// Pure order/pricing logic — no React, no DB, no navigator. Kept side-effect
// free so it unit-tests cleanly and behaves identically on server and client.
// Owns: option pricing, the cart reducer (client), and the server-side line
// rebuild that recomputes prices from the catalog (never trust the client).

/**
 * One option the operator picked for a line. We carry the delta (and name) so a
 * line can be priced and later snapshotted onto an order row without another DB
 * read — the order stays correct even if the catalog is edited afterwards.
 */
export type SelectedOption = {
  groupId: string;
  optionId: string;
  name: string;
  priceDeltaCents: number;
};

/**
 * What lands in `order_items.options_snapshot`: just the facts a receipt or
 * report needs. Immune to later catalog edits/deletes.
 */
export type OptionSnapshot = {
  name: string;
  priceDeltaCents: number;
};

/**
 * An item's base price plus every chosen option's delta. Integer cents in,
 * integer cents out. Clamped at 0 so a stray negative delta can never produce a
 * negative line price — money math must never surprise the till.
 */
export function resolveUnitPrice(
  baseCents: number,
  selected: readonly { priceDeltaCents: number }[],
): number {
  const total = selected.reduce(
    (sum, opt) => sum + opt.priceDeltaCents,
    baseCents,
  );
  return Math.max(0, total);
}

// ============================================================================
// Cart reducer (client) — pure. lib/use-cart.ts wires it to useReducer +
// localStorage + the idempotency key.
// ============================================================================

/** One ticket line: an item + its exact chosen option set + optional note. */
export type CartLine = {
  key: string; // identity: same key => same line, quantity merges
  itemId: string;
  itemName: string;
  baseCents: number;
  unitPriceCents: number; // base + option deltas, per unit
  quantity: number;
  note: string; // "" when none
  options: SelectedOption[];
};

export type CartState = {
  lines: CartLine[];
  /** Fulfilment: null = Takeaway, else Dine-in ("" = no table given, or a label). */
  tableLabel: string | null;
};

export const EMPTY_CART: CartState = { lines: [], tableLabel: null };

export type CartAction =
  | {
      type: "add";
      itemId: string;
      itemName: string;
      baseCents: number;
      options: SelectedOption[];
      note: string;
      quantity: number;
    }
  | { type: "inc"; key: string }
  | { type: "dec"; key: string }
  | { type: "remove"; key: string }
  | { type: "setTable"; tableLabel: string | null }
  | { type: "clear" }
  | { type: "hydrate"; state: CartState };

/**
 * A line's identity. A line = item + its exact chosen option set + note. Same
 * item + same options + same note merges (quantity ++); a different option set
 * or note splits into a new line. Option order must not matter, so ids sort.
 */
export function makeLineKey(
  itemId: string,
  options: readonly SelectedOption[],
  note: string,
): string {
  const ids = options
    .map((o) => o.optionId)
    .sort()
    .join(",");
  return `${itemId}|${ids}|${note.trim()}`;
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "clear":
      return EMPTY_CART;

    case "setTable":
      return { ...state, tableLabel: action.tableLabel };

    case "add": {
      const note = action.note.trim();
      const key = makeLineKey(action.itemId, action.options, note);
      const qty = Math.max(1, Math.floor(action.quantity));
      const existing = state.lines.find((l) => l.key === key);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.key === key ? { ...l, quantity: l.quantity + qty } : l,
          ),
        };
      }
      const line: CartLine = {
        key,
        itemId: action.itemId,
        itemName: action.itemName,
        baseCents: action.baseCents,
        unitPriceCents: resolveUnitPrice(action.baseCents, action.options),
        quantity: qty,
        note,
        options: action.options,
      };
      return { ...state, lines: [...state.lines, line] };
    }

    case "inc":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.key === action.key ? { ...l, quantity: l.quantity + 1 } : l,
        ),
      };

    case "dec":
      // Decrement, dropping the line when it would hit zero.
      return {
        ...state,
        lines: state.lines.flatMap((l) => {
          if (l.key !== action.key) return [l];
          return l.quantity <= 1 ? [] : [{ ...l, quantity: l.quantity - 1 }];
        }),
      };

    case "remove":
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
  }
}

/** Ticket total in cents: sum of unit price × quantity across all lines. */
export function cartTotalCents(state: CartState): number {
  return state.lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
}

/** Total number of physical items (for the clear-order confirmation copy). */
export function cartItemCount(state: CartState): number {
  return state.lines.reduce((sum, l) => sum + l.quantity, 0);
}

/**
 * One saved order line, in the minimal shape needed to rebuild an editable cart
 * line. This is what `order_items` stores: names + snapshot deltas, no ids for
 * the options (snapshot, not reference). The unit price is carried so a line
 * whose item has since vanished from the active catalog can still show its
 * original price instead of collapsing to zero.
 */
export type OrderLineSnapshotView = {
  itemId: string | null; // null once the source item is hard-deleted
  itemName: string;
  quantity: number;
  note: string | null;
  unitPriceCents: number;
  options: OptionSnapshot[]; // { name, priceDeltaCents }
};

/**
 * Rebuild an editable cart from a saved (unpaid) order. Snapshots carry option
 * NAMES, not ids, so each option is matched back to a live catalog option by
 * name within the item's groups — recovering the group/option ids the terminal
 * needs to re-select chips and the server needs to re-price. Prices are taken
 * from the CURRENT catalog (editing = re-quote), consistent with placeOrder's
 * server-side re-pricing. If an item is no longer in the active catalog its line
 * is kept read-as-was (original unit price, no re-selectable options) so the
 * operator can at least see and remove it; the server's buildOrderLine is the
 * final guard on save.
 */
export function reconstructCartState(
  items: readonly CatalogItemView[],
  tableLabel: string | null,
  lines: readonly OrderLineSnapshotView[],
): CartState {
  const byId = new Map(items.map((i) => [i.id, i]));
  const cartLines: CartLine[] = lines.map((line) => {
    const itemId = line.itemId ?? "";
    const item = itemId ? byId.get(itemId) : undefined;
    const note = (line.note ?? "").trim();

    const chosen: SelectedOption[] = [];
    if (item) {
      for (const snap of line.options) {
        for (const group of item.optionGroups) {
          const opt = group.options.find(
            (o) => o.name === snap.name && o.isActive,
          );
          if (opt) {
            chosen.push({
              groupId: group.id,
              optionId: opt.id,
              name: opt.name,
              priceDeltaCents: opt.priceDeltaCents,
            });
            break;
          }
        }
      }
    }

    const baseCents = item ? item.priceCents : 0;
    const unitPriceCents = item
      ? resolveUnitPrice(baseCents, chosen)
      : line.unitPriceCents;

    return {
      key: makeLineKey(itemId, chosen, note),
      itemId,
      itemName: line.itemName,
      baseCents,
      unitPriceCents,
      quantity: line.quantity,
      note,
      options: chosen,
    };
  });

  return { lines: cartLines, tableLabel };
}

/**
 * Change due for a cash payment, in cents. Pure + server-authoritative: the
 * amount tendered comes from the client, but the change is computed here and
 * the tender is rejected if it's below the total or not a sane integer.
 */
export function computeChangeCents(
  totalCents: number,
  tenderedCents: number,
): number {
  if (!Number.isInteger(tenderedCents) || tenderedCents < 0) {
    throw new Error("Enter a valid cash amount.");
  }
  if (tenderedCents < totalCents) {
    throw new Error("Amount tendered is less than the total.");
  }
  return tenderedCents - totalCents;
}

/**
 * Human label for an order's fulfilment. null = Takeaway; "" = Dine-in with no
 * table given; any other string = that table ("Table 5").
 */
export function formatFulfilment(tableLabel: string | null): string {
  if (tableLabel === null) return "Takeaway";
  const t = tableLabel.trim();
  return t === "" ? "Dine-in" : `Table ${t}`;
}

// ============================================================================
// Server-side line rebuild — the anti-tamper boundary. The client sends only
// ids + quantity + note; the server re-prices every line from the catalog it
// just read. Pure so it can be unit-tested without a DB.
// ============================================================================

/** Minimal catalog shape this module needs; ItemWithOptions is assignable. */
export type CatalogOptionView = {
  id: string;
  name: string;
  priceDeltaCents: number;
  isActive: boolean;
};
export type CatalogGroupView = {
  id: string;
  name: string;
  required: boolean;
  options: CatalogOptionView[];
};
export type CatalogItemView = {
  id: string;
  name: string;
  priceCents: number;
  isActive: boolean;
  optionGroups: CatalogGroupView[];
};

/** What the client posts per line. Prices are deliberately absent. */
export type OrderLineInput = {
  itemId: string;
  optionIds: string[];
  note: string;
  quantity: number;
};

/** A fully-priced, snapshot-ready line the DAL inserts as an order_item. */
export type OrderLineDraft = {
  itemId: string;
  itemName: string;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
  options: OptionSnapshot[];
};

/**
 * Rebuild one line from the catalog, throwing on anything the client shouldn't
 * be able to submit (unknown/inactive item, unknown/inactive option, an option
 * that isn't this item's, a required group left unchosen, bad quantity). The
 * returned unit price is computed here — the client's number is never used.
 */
export function buildOrderLine(
  item: CatalogItemView,
  input: OrderLineInput,
): OrderLineDraft {
  if (!item.isActive) {
    throw new Error(`Item ${item.name} is not available.`);
  }
  const quantity = Math.floor(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error(`Invalid quantity for ${item.name}.`);
  }

  // Index every active option of this item so we can validate the ids sent.
  const chosen: SelectedOption[] = [];
  const wanted = new Set(input.optionIds);

  for (const group of item.optionGroups) {
    const picks = group.options.filter(
      (o) => wanted.has(o.id) && o.isActive,
    );
    if (picks.length > 1) {
      throw new Error(`Pick only one ${group.name}.`);
    }
    if (picks.length === 0) {
      if (group.required) {
        throw new Error(`${item.name} needs a ${group.name}.`);
      }
      continue;
    }
    const pick = picks[0];
    chosen.push({
      groupId: group.id,
      optionId: pick.id,
      name: pick.name,
      priceDeltaCents: pick.priceDeltaCents,
    });
  }

  // Reject any submitted option id that isn't a valid active option of a group.
  const validIds = new Set(chosen.map((c) => c.optionId));
  for (const id of input.optionIds) {
    if (!validIds.has(id)) {
      throw new Error(`Unknown option for ${item.name}.`);
    }
  }

  const note = input.note.trim();
  return {
    itemId: item.id,
    itemName: item.name,
    unitPriceCents: resolveUnitPrice(item.priceCents, chosen),
    quantity,
    note: note === "" ? null : note,
    options: chosen.map((c) => ({
      name: c.name,
      priceDeltaCents: c.priceDeltaCents,
    })),
  };
}
