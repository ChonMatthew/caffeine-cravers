// The ONLY place money is formatted or parsed. Everything else passes integer
// cents around. Locale/currency are pinned constants — never read from the
// browser, or server and client would format differently (hydration mismatch).

const LOCALE = "en-MY";
const CURRENCY = "MYR";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
});

/** 700 -> "RM 7.00". For display only. */
export function formatCents(cents: number): string {
  // Intl inserts a non-breaking space between symbol and number. In JS, \s
  // matches U+00A0 / U+202F too, so this normalizes it to a plain space —
  // predictable output that also prints cleanly on the thermal receipt.
  return currencyFormatter.format(cents / 100).replace(/\s+/g, " ");
}

/** 750 -> "7.50". Plain number string for pre-filling an editable price field. */
export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}

/**
 * "7.50" -> 750. Integer math only, so no float rounding errors.
 * Accepts "7", "7.5", "7.50", "07.50". Throws on anything else (letters,
 * negatives, more than 2 decimals, empty).
 */
export function parseAmountToCents(input: string): number {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Enter an amount like 7 or 7.50");
  }
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
