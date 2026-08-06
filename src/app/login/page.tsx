"use client";

import { useActionState, useState } from "react";

import { login, type LoginState } from "./actions";

const initialState: LoginState = {};
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const PIN_LENGTH = 6;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [pin, setPin] = useState("");

  const push = (d: string) =>
    setPin((p) => (p.length < PIN_LENGTH ? p + d : p));

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-10 p-8">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        <h1 className="text-4xl font-bold tracking-wide">Enter PIN</h1>

        {/* Filled/empty dots showing how many digits entered */}
        <div className="flex gap-4" aria-label="PIN entry">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-5 w-5 rounded-full border-2 border-foreground/40 ${
                i < pin.length ? "bg-foreground" : ""
              }`}
            />
          ))}
        </div>

        {state.error && (
          <p className="text-base text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <form action={formAction} className="w-full">
          <input type="hidden" name="pin" value={pin} />
          <div className="grid grid-cols-3 gap-4">
          {KEYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => push(d)}
              className="min-h-24 rounded-2xl border border-foreground/20 text-4xl font-medium active:bg-foreground/10"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin("")}
            className="min-h-24 rounded-2xl border border-foreground/20 text-lg active:bg-foreground/10"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => push("0")}
            className="min-h-24 rounded-2xl border border-foreground/20 text-4xl font-medium active:bg-foreground/10"
          >
            0
          </button>
          <button
            type="submit"
            disabled={pending || pin.length < 4}
            className="min-h-24 rounded-2xl bg-accent text-xl font-semibold text-accent-foreground disabled:opacity-40"
          >
            {pending ? "…" : "Enter"}
          </button>
        </div>
        </form>
      </div>
    </main>
  );
}
