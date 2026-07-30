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
    <main className="mx-auto flex min-h-full max-w-xs flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Enter PIN</h1>

      {/* Filled/empty dots showing how many digits entered */}
      <div className="flex gap-3" aria-label="PIN entry">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border border-foreground/40 ${
              i < pin.length ? "bg-foreground" : ""
            }`}
          />
        ))}
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <form action={formAction} className="w-full">
        <input type="hidden" name="pin" value={pin} />
        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => push(d)}
              className="min-h-16 rounded-lg border border-foreground/20 text-2xl"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin("")}
            className="min-h-16 rounded-lg border border-foreground/20 text-sm"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => push("0")}
            className="min-h-16 rounded-lg border border-foreground/20 text-2xl"
          >
            0
          </button>
          <button
            type="submit"
            disabled={pending || pin.length < 4}
            className="min-h-16 rounded-lg bg-accent text-accent-foreground disabled:opacity-40"
          >
            {pending ? "…" : "Enter"}
          </button>
        </div>
      </form>
    </main>
  );
}
