"use client";

// The order screen's cart state: the pure reducer (lib/order.ts) wired to
// useReducer, persisted to localStorage (survives a refresh / lost wifi), and
// carrying a per-cart idempotency key so a retried Place Order can't double the
// sale. All the money logic lives in the pure reducer; this is just the plumbing.

import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  cartItemCount,
  cartReducer,
  cartTotalCents,
  EMPTY_CART,
  type CartState,
  type SelectedOption,
} from "@/lib/order";

const STORAGE_KEY = "cc-cart-v1";

type Persisted = { state: CartState; key: string };

export type AddToCart = {
  itemId: string;
  itemName: string;
  baseCents: number;
  options: SelectedOption[];
  note: string;
  quantity: number;
};

/**
 * Options for the two modes this hook runs in:
 * - New order (default): starts empty, restores from / persists to localStorage.
 * - Editing an unpaid order: `persist: false` + a pre-seeded `initial` cart.
 *   It stays isolated from the localStorage key so editing an order never
 *   clobbers a new-order ticket the operator has in progress.
 */
export type UseCartOptions = { initial?: CartState; persist?: boolean };

export function useCart(opts?: UseCartOptions) {
  const persist = opts?.persist ?? true;
  const [state, dispatch] = useReducer(cartReducer, opts?.initial ?? EMPTY_CART);
  // The idempotency key isn't rendered, so it lives in a ref (no re-render, no
  // setState-in-effect). It's populated on mount, before any item can be added.
  const keyRef = useRef<string>("");
  const skipFirstPersist = useRef(true);

  // Restore a cart left behind by a refresh or a dropped connection. Reading
  // localStorage must happen after mount (it doesn't exist during SSR), so this
  // stays an effect — but it only dispatches/assigns a ref, never setState.
  // Skipped entirely in edit mode: that cart is seeded from the order, not disk.
  useEffect(() => {
    if (!persist) {
      keyRef.current = crypto.randomUUID();
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<Persisted>) : null;
      if (parsed?.state?.lines) {
        dispatch({
          type: "hydrate",
          // tableLabel may be absent in a cart saved before this field existed.
          state: {
            lines: parsed.state.lines,
            tableLabel: parsed.state.tableLabel ?? null,
          },
        });
      }
      keyRef.current = parsed?.key || crypto.randomUUID();
    } catch {
      keyRef.current = crypto.randomUUID();
    }
  }, [persist]);

  // Persist on every change. Skip the very first run (the empty mount state) so
  // we never clobber a saved cart before the restore dispatch lands. In edit
  // mode we never write to the shared cart key at all.
  useEffect(() => {
    if (!persist) return;
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    try {
      const payload: Persisted = { state, key: keyRef.current };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage full / unavailable — non-fatal, the cart just won't survive a reload
    }
  }, [state, persist]);

  const add = useCallback((p: AddToCart) => {
    dispatch({ type: "add", ...p });
  }, []);
  const inc = useCallback((key: string) => dispatch({ type: "inc", key }), []);
  const dec = useCallback((key: string) => dispatch({ type: "dec", key }), []);
  const remove = useCallback(
    (key: string) => dispatch({ type: "remove", key }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: "clear" }), []);
  const setTable = useCallback(
    (tableLabel: string | null) => dispatch({ type: "setTable", tableLabel }),
    [],
  );

  // The idempotency key for the current cart, read only when Place Order fires
  // (in a callback, never during render). Lazily minted as a safety net.
  const getIdempotencyKey = useCallback(() => {
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    return keyRef.current;
  }, []);

  // After a successful Place Order: empty the ticket and mint a fresh key so the
  // next order is a distinct sale.
  const resetAfterPlace = useCallback(() => {
    keyRef.current = crypto.randomUUID();
    dispatch({ type: "clear" });
  }, []);

  return {
    lines: state.lines,
    state,
    tableLabel: state.tableLabel,
    total: cartTotalCents(state),
    count: cartItemCount(state),
    getIdempotencyKey,
    add,
    inc,
    dec,
    remove,
    clear,
    setTable,
    resetAfterPlace,
  };
}
