"use server";

import { revalidatePath } from "next/cache";

import {
  createItem,
  createOption,
  createOptionGroup,
  deleteOption,
  deleteOptionGroup,
  requireSession,
  setItemActive,
  setOptionActive,
  updateItem,
} from "@/lib/dal";
import {
  parseGroupForm,
  parseOptionForm,
  validateItemForm,
} from "@/lib/validation";

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

// --- option groups & options (all plain form actions) ------------------------

export async function addGroupAction(formData: FormData): Promise<void> {
  await requireSession();
  const itemId = String(formData.get("itemId") ?? "");
  const parsed = parseGroupForm(formData);
  if (itemId && parsed) {
    await createOptionGroup(itemId, parsed);
    revalidatePath("/catalog");
  }
}

export async function removeGroupAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("groupId") ?? "");
  if (id) {
    await deleteOptionGroup(id);
    revalidatePath("/catalog");
  }
}

export async function addOptionAction(formData: FormData): Promise<void> {
  await requireSession();
  const groupId = String(formData.get("groupId") ?? "");
  const parsed = parseOptionForm(formData);
  if (groupId && parsed) {
    await createOption(groupId, parsed);
    revalidatePath("/catalog");
  }
}

export async function removeOptionAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("optionId") ?? "");
  if (id) {
    await deleteOption(id);
    revalidatePath("/catalog");
  }
}

export async function toggleOptionActiveAction(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const id = String(formData.get("optionId") ?? "");
  const active = formData.get("active") === "true";
  if (id) {
    await setOptionActive(id, active);
    revalidatePath("/catalog");
  }
}
