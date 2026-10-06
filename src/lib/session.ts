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

// The shop the operator picked at login rides in the signed token, so it can't
// be changed client-side. Switching shop = Lock, then log in to the other one.
export async function signSessionToken(shopId: string): Promise<string> {
  return new SignJWT({ role: "operator", shopId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

/** The session's shop id, or null when there's no valid session. */
export async function verifySessionToken(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    // A token from before the shop split has no shopId: treat it as logged
    // out, so the operator picks a shop once after that deploy.
    return typeof payload.shopId === "string" && payload.shopId
      ? payload.shopId
      : null;
  } catch {
    // Invalid signature, expired, or malformed — all mean "no session".
    return null;
  }
}
