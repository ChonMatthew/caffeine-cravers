"use server";

import { revalidatePath } from "next/cache";

import {
  createItem,
  requireSession,
  setItemActive,
  updateItem,
} from "@/lib/dal";
import { validateItemForm } from "@/lib/validation";

export type ItemFormState = {
  errors?: Record<string, string>;
  ok?: boolean;
};

export async function createItemAction(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  await requireSession();
  const result = validateItemForm(formData);
  if (!result.ok) return { errors: result.errors };

  await createItem(result.value);
  revalidatePath("/catalog");
  return { ok: true };
}

export async function updateItemAction(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { errors: { form: "Missing item id." } };

  const result = validateItemForm(formData);
  if (!result.ok) return { errors: result.errors };

  await updateItem(id, result.value);
  revalidatePath("/catalog");
  return { ok: true };
}

// Simple form action (no useActionState) — flips active/inactive.
export async function toggleItemActiveAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (id) {
    await setItemActive(id, active);
    revalidatePath("/catalog");
  }
}
