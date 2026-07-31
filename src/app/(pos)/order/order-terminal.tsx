"use client";

// The interactive till: category tabs + item grid on the left, the order ticket
// on the right. Tapping any item opens the add/variations pop-up (options +
// note + quantity, for EVERY item). The cart lives in useCart (pure reducer +
// localStorage + idempotency key); Place Order re-prices server-side.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { formatCents } from "@/lib/money";
import type { SelectedOption } from "@/lib/order";
import { useCart } from "@/lib/use-cart";

import { placeOrder } from "./actions";

export type MenuOption = { id: string; name: string; priceDeltaCents: number };
export type MenuGroup = {
  id: string;
  name: string;
  required: boolean;
  options: MenuOption[];
};
export type MenuItem = {
  id: string;
  name: string;
  priceCents: number;
  category: string | null;
  groups: MenuGroup[];
};

const CAT_VARS = ["--cat-coffee", "--cat-cold", "--cat-pastry", "--cat-other"];
const UNCATEGORISED = "Other";

/** "+2.00" / "+0.00" — the compact option-delta label on chips. */
function delta(cents: number): string {
  const sign = cents < 0 ? "-" : "+";
  return `${sign}${(Math.abs(cents) / 100).toFixed(2)}`;
}

function catOf(item: MenuItem): string {
  return item.category ?? UNCATEGORISED;
}

export function OrderTerminal({ menu }: { menu: MenuItem[] }) {
  const cart = useCart();
  const router = useRouter();
  const [activeCat, setActiveCat] = useState("All");
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placing, startPlacing] = useTransition();

  // Categories derived dynamically from the menu — never hardcoded.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const it of menu) {
      const c = catOf(it);
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [menu]);

  const catColor = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c, i) => m.set(c, CAT_VARS[i % CAT_VARS.length]));
    return m;
  }, [categories]);

  const visible = useMemo(
    () => menu.filter((it) => activeCat === "All" || catOf(it) === activeCat),
    [menu, activeCat],
  );

  const handlePlace = useCallback(() => {
    if (!cart.lines.length || placing) return;
    const key = cart.getIdempotencyKey();
    const lines = cart.lines.map((l) => ({
      itemId: l.itemId,
      optionIds: l.options.map((o) => o.optionId),
      note: l.note,
      quantity: l.quantity,
    }));
    setPlaceError(null);
    startPlacing(async () => {
      const res = await placeOrder({ idempotencyKey: key, lines });
      if (res.ok) {
        cart.resetAfterPlace();
        router.push(`/order/${res.orderId}`);
      } else {
        // Keep the cart so the operator can retry — the idempotency key makes
        // that safe (a duplicate submit won't create a second order).
        setPlaceError(res.error);
      }
    });
  }, [cart, placing, router]);

  return (
    <div className="order">
      {/* ---------- menu (left) ---------- */}
      <section className="menu">
        <div className="tabs" role="tablist">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              className="tab"
              role="tab"
              aria-current={c === activeCat}
              onClick={() => setActiveCat(c)}
            >
              {c !== "All" && (
                <span
                  className="cdot"
                  style={{ background: `var(${catColor.get(c)})` }}
                  aria-hidden
                />
              )}
              {c}
            </button>
          ))}
        </div>

        <div className="menu-grid">
          {visible.map((item) => (
            <button
              key={item.id}
              className="tile"
              onClick={() => setModalItem(item)}
            >
              <span
                className="cdot"
                style={{ background: `var(${catColor.get(catOf(item))})` }}
                aria-hidden
              />
              <div className="t-name">{item.name}</div>
              <div className="t-foot">
                <span className="t-price">{formatCents(item.priceCents)}</span>
                {item.groups.length > 0 && (
                  <span className="t-opt">Options ▸</span>
                )}
              </div>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="empty">No items in this category.</p>
          )}
        </div>
      </section>

      {/* ---------- ticket (right) ---------- */}
      <aside className="ticket">
        <div className="t-head">
          <h2>Order</h2>
          <span className="tno">New</span>
          <button
            className="clear"
            disabled={!cart.lines.length}
            onClick={() => setConfirmClear(true)}
          >
            Clear order
          </button>
        </div>

        <div className="lines">
          {cart.lines.length === 0 ? (
            <div className="empty">
              No items yet.
              <br />
              Tap a product to start the ticket.
            </div>
          ) : (
            cart.lines.map((l) => {
              const vr = l.options.map((o) => o.name).join(" · ");
              return (
                <div className="line" key={l.key}>
                  <div className="info">
                    <div className="nm">{l.itemName}</div>
                    {vr && <div className="vr">{vr}</div>}
                    {l.note && <div className="note">“{l.note}”</div>}
                  </div>
                  <div className="step">
                    <button aria-label="One less" onClick={() => cart.dec(l.key)}>
                      −
                    </button>
                    <span className="n">{l.quantity}</span>
                    <button aria-label="One more" onClick={() => cart.inc(l.key)}>
                      +
                    </button>
                  </div>
                  <div className="lt">
                    {formatCents(l.unitPriceCents * l.quantity)}
                  </div>
                  <button
                    className="rm"
                    aria-label={`Remove ${l.itemName}`}
                    onClick={() => cart.remove(l.key)}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="totals">
          <div className="totrow">
            <span>Subtotal</span>
            <span className="amt">{formatCents(cart.total)}</span>
          </div>
          <div className="totrow grand">
            <span className="lbl">Total</span>
            <span className="amt">{formatCents(cart.total)}</span>
          </div>
        </div>

        {placeError && (
          <p
            className="stub-note"
            style={{ color: "var(--brick)", margin: "0 18px 8px" }}
            role="alert"
          >
            {placeError} — tap Place Order to retry.
          </p>
        )}

        <button
          className="place"
          disabled={!cart.lines.length || placing}
          onClick={handlePlace}
        >
          {placing ? "Placing…" : "Place Order"} <span aria-hidden>→</span>
        </button>
      </aside>

      {/* ---------- add / variations modal ---------- */}
      {modalItem && (
        <AddModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onAdd={(payload) => {
            cart.add(payload);
            setModalItem(null);
          }}
        />
      )}

      {/* ---------- clear-order guardrail ---------- */}
      {confirmClear && (
        <div
          className="scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmClear(false);
          }}
        >
          <div className="confirm" role="dialog" aria-modal="true">
            <h3>Clear order?</h3>
            <p>
              This removes all {cart.count} item{cart.count === 1 ? "" : "s"} from
              the current ticket.
            </p>
            <div className="row">
              <button className="cancel" onClick={() => setConfirmClear(false)}>
                Keep order
              </button>
              <button
                className="danger"
                onClick={() => {
                  cart.clear();
                  setConfirmClear(false);
                }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The universal add pop-up: variation groups (single-select), an optional note,
// and a quantity stepper — shown for every item, even those with no variations.
// ---------------------------------------------------------------------------
function AddModal({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (payload: {
    itemId: string;
    itemName: string;
    baseCents: number;
    options: SelectedOption[];
    note: string;
    quantity: number;
  }) => void;
}) {
  // Default-select the first option of each group (single-select chips).
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of item.groups) if (g.options[0]) init[g.id] = g.options[0].id;
    return init;
  });
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chosenOptions: SelectedOption[] = item.groups.flatMap((g) => {
    const optId = selected[g.id];
    const opt = g.options.find((o) => o.id === optId);
    return opt
      ? [
          {
            groupId: g.id,
            optionId: opt.id,
            name: opt.name,
            priceDeltaCents: opt.priceDeltaCents,
          },
        ]
      : [];
  });

  const unit =
    item.priceCents +
    chosenOptions.reduce((s, o) => s + o.priceDeltaCents, 0);
  const lineTotal = Math.max(0, unit) * qty;

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={item.name}>
        <div className="m-head">
          <h3>{item.name}</h3>
          <span className="m-base">
            {item.groups.length ? `base ${formatCents(item.priceCents)}` : formatCents(item.priceCents)}
          </span>
        </div>

        <div className="m-body">
          {item.groups.map((g) => (
            <div className="grp" key={g.id}>
              <div className="g-lbl">
                {g.name}
                {g.required && <span className="req">REQUIRED</span>}
              </div>
              <div className="chips">
                {g.options.map((o) => (
                  <button
                    key={o.id}
                    className="chip"
                    aria-pressed={selected[g.id] === o.id}
                    onClick={() =>
                      setSelected((s) => ({ ...s, [g.id]: o.id }))
                    }
                  >
                    {o.name}
                    <span className="dp">{delta(o.priceDeltaCents)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="grp">
            <div className="g-lbl">
              Note <span style={{ color: "var(--ink-faint)" }}>optional</span>
            </div>
            <input
              className="note-in"
              maxLength={80}
              placeholder="e.g. no sugar, extra hot, oat milk"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="grp">
            <div className="g-lbl">Quantity</div>
            <div className="qtyrow">
              <div className="step big">
                <button
                  aria-label="One less"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span className="n">{qty}</span>
                <button aria-label="One more" onClick={() => setQty((q) => q + 1)}>
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="m-foot">
          <button className="m-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="m-add"
            onClick={() =>
              onAdd({
                itemId: item.id,
                itemName: item.name,
                baseCents: item.priceCents,
                options: chosenOptions,
                note,
                quantity: qty,
              })
            }
          >
            Add to order <span className="mp">{formatCents(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
