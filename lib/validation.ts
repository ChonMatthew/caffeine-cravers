import { parseAmountToCents } from "@/lib/money";

// Validate the catalog item form. Server-side validation is the only kind that
// counts — the client form does the same checks only for fast feedback.

export type ItemInput = {
  name: string;
  priceCents: number;
  category: string | null;
};

export type ValidationResult =
  | { ok: true; value: ItemInput }
  | { ok: false; errors: Record<string, string> };

export function validateItemForm(formData: FormData): ValidationResult {
  const errors: Record<string, string> = {};

  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length > 60) {
    errors.name = "Name must be 60 characters or fewer.";
  }

  let priceCents = 0;
  try {
    priceCents = parseAmountToCents(priceRaw);
  } catch {
    errors.price = "Enter a price like 7.50.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { name, priceCents, category: category || null },
  };
}
