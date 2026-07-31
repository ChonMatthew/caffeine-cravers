"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyPin } from "@/lib/auth";
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

  // Flat delay on every attempt — throttles brute force without ever locking
  // out the single operator, who must be able to retry immediately.
  await new Promise((r) => setTimeout(r, 300));

  const ok = verifyPin(pin, process.env.POS_PIN_HASH);
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

  redirect("/"); // the home hub (req #1) — not a redirect to /order
}
