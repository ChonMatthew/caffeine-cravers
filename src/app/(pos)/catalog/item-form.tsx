"use client";

import { useActionState, useEffect, useRef } from "react";

import type { Item } from "@/db/schema";
import { centsToInput } from "@/lib/money";

import {
  createItemAction,
  updateItemAction,
  type ItemFormState,
} from "./actions";

const initialState: ItemFormState = {};

// Editing surface for one item: name, category, price. Used both as the "add"
// form (no item) and inline on each active card (with an item). The server
// action re-validates; price is parsed to integer cents in lib/money.
export function ItemForm({ item }: { item?: Item }) {
  const isEdit = Boolean(item);
  const action = isEdit ? updateItemAction : createItemAction;
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(
    action,
    initialState,
  );

  // Clear the ADD form after a successful add so the next item starts blank.
  // `state` is a fresh object per submit, so this fires on each success. The
  // EDIT form keeps its values (they reflect the saved item). Every field
  // below is a plain uncontrolled input (defaultValue/defaultChecked), so a
  // native form.reset() is all that's needed — no React state to mirror it.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !isEdit) formRef.current?.reset();
  }, [state, isEdit]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={isEdit ? "ic-edit" : "ic-add-form"}
    >
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="ic-field-wrap name">
        <input
          name="name"
          defaultValue={item?.name ?? ""}
          placeholder="Item name"
          maxLength={60}
          className="field name"
        />
        {state.errors?.name && (
          <span className="field-err">{state.errors.name}</span>
        )}
      </div>

      <input
        name="category"
        defaultValue={item?.category ?? ""}
        placeholder="Category"
        maxLength={40}
        className="field cat"
      />

      <div className="dine-toggle" role="group" aria-label="Prints to">
        <label className="seg">
          <input
            type="radio"
            name="station"
            value="drink"
            defaultChecked={(item?.station ?? "drink") === "drink"}
          />
          Drink
        </label>
        <label className="seg">
          <input
            type="radio"
            name="station"
            value="food"
            defaultChecked={item?.station === "food"}
          />
          Food
        </label>
      </div>

      <div className="ic-field-wrap">
        <div className="ic-price">
          <span className="ic-price-label">RM</span>
          <input
            name="price"
            inputMode="decimal"
            defaultValue={item ? centsToInput(item.priceCents) : ""}
            placeholder="0.00"
            className="field money"
          />
        </div>
        {state.errors?.price && (
          <span className="field-err">{state.errors.price}</span>
        )}
      </div>

      <button type="submit" disabled={pending} className="mini primary">
        {pending ? "…" : isEdit ? "Save" : "+ Add item"}
      </button>

      {state.ok && <span className="field-ok">Saved</span>}
      {state.errors?.form && (
        <span className="field-err">{state.errors.form}</span>
      )}
    </form>
  );
}
