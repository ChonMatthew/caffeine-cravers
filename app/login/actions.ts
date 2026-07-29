"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyPin } from "@/lib/auth";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSessionToken,
} from "@/lib/session";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const pin = String(formData.get("pin") ?? "");

  // Flat delay on every attempt — caps brute-force throughput cheaply.
  await new Promise((r) => setTimeout(r, 300));

  if (await isRateLimited()) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const ok = verifyPin(pin, process.env.POS_PIN_HASH);
  await recordAttempt(ok);

  if (!ok) {
    return { error: "Incorrect PIN." };
  }

  // Success: set the signed session cookie.
  const token = await signSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Won't set over http://localhost — must be false in dev or login "fails"
    // silently by never storing the cookie.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/"); // Phase 4 changes this to /order
}
