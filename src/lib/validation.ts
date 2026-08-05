import { parseAmountToCents } from "@/lib/money";

// Prices/deltas are stored as int4 cents (~RM 21M ceiling). Cap well below that
// so an absurd value is rejected with a clean message instead of overflowing and
// throwing a raw DB error at insert time.
const MAX_PRICE_CENTS = 100_000_00; // RM 100,000

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
    if (priceCents > MAX_PRICE_CENTS) {
      errors.price = "Price is too large — max RM 100,000.";
    }
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

// --- option groups & options -------------------------------------------------
// These back plain form actions (no useActionState channel to show errors), so
// they return the parsed value or null and the action skips the write on null.
// The forms already guard the common cases client-side (required, number input).

export function parseGroupForm(
  formData: FormData,
): { name: string; required: boolean } | null {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 40) return null;
  // Checkbox: present only when ticked.
  const required = formData.get("required") != null;
  return { name, required };
}

export function parseOptionForm(
  formData: FormData,
): { name: string; priceDeltaCents: number } | null {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 40) return null;

  // Empty delta means "no upcharge" (0), not an error.
  const priceRaw = String(formData.get("price") ?? "").trim() || "0";
  try {
    const priceDeltaCents = parseAmountToCents(priceRaw);
    if (priceDeltaCents > MAX_PRICE_CENTS) return null;
    return { name, priceDeltaCents };
  } catch {
    return null;
  }
}
