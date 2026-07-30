// Generate a POS_PIN_HASH for a chosen PIN.
// Usage:  npm run hash-pin -- 123456
// Prints the env line to paste into .env.local and Vercel. Your PIN is never
// stored or transmitted.
import { hashPin } from "../src/lib/auth";

const pin = process.argv[2];

if (!pin || !/^\d{4,}$/.test(pin)) {
  console.error("Usage: npm run hash-pin -- <PIN>  (digits only, 4+; use 6)");
  process.exit(1);
}

console.log("");
console.log("Add this line to .env.local and to Vercel env (all 3 environments):");
console.log("");
console.log(`POS_PIN_HASH="${hashPin(pin)}"`);
console.log("");
