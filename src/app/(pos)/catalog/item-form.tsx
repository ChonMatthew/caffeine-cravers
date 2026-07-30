"use client";

import { useActionState } from "react";

import type { Item } from "@/db/schema";
import { centsToInput } from "@/lib/money";

import {
  createItemAction,
  updateItemAction,
  type ItemFormState,
} from "./actions";

const initialState: ItemFormState = {};

export function ItemForm({ item }: { item?: Item }) {
  const isEdit = Boolean(item);
  const action = isEdit ? updateItemAction : createItemAction;
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(
    action,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="flex flex-col">
        <input
          name="name"
          defaultValue={item?.name ?? ""}
          placeholder="Name"
          className="min-h-11 rounded-md border border-foreground/20 px-3"
        />
        {state.errors?.name && (
          <span className="text-xs text-red-600">{state.errors.name}</span>
        )}
      </div>

      <div className="flex flex-col">
        <input
          name="price"
          defaultValue={item ? centsToInput(item.priceCents) : ""}
          placeholder="0.00"
          inputMode="decimal"
          className="min-h-11 w-24 rounded-md border border-foreground/20 px-3"
        />
        {state.errors?.price && (
          <span className="text-xs text-red-600">{state.errors.price}</span>
        )}
      </div>

      <input
        name="category"
        defaultValue={item?.category ?? ""}
        placeholder="Category"
        className="min-h-11 w-32 rounded-md border border-foreground/20 px-3"
      />

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-accent px-4 text-accent-foreground disabled:opacity-40"
      >
        {pending ? "…" : isEdit ? "Save" : "Add"}
      </button>

      {state.ok && (
        <span className="self-center text-sm text-green-600">Saved</span>
      )}
    </form>
  );
}
