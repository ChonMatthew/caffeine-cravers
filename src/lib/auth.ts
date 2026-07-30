import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// PIN hashing with salted scrypt. Stored format: "<saltHex>:<keyHex>".
// We store a hash of the PIN, never the PIN itself.

const KEY_LENGTH = 64;

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(pin, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${key}`;
}

export function verifyPin(pin: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = scryptSync(pin, salt, KEY_LENGTH);

  // Lengths must match for timingSafeEqual, and constant-time compare avoids
  // leaking how much of the hash matched.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
