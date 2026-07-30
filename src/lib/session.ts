import { SignJWT, jwtVerify } from "jose";

// Session token helpers. No next/headers or server-only here on purpose, so
// proxy.ts can import verifySessionToken. Cookie set/delete lives in actions.

export const SESSION_COOKIE = "pos_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(): Promise<string> {
  return new SignJWT({ role: "operator" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    // Invalid signature, expired, or malformed — all mean "no session".
    return false;
  }
}
