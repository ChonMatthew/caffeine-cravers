"use client";

// Error boundary for every screen behind the till. A real failure (e.g. the DB
// is unreachable) lands here instead of a raw crash. Expired sessions never reach
// this — requireSession() redirects those to /login before rendering.

import Link from "next/link";
import { useEffect } from "react";

export default function PosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flow">
      <div className="flowcard" style={{ textAlign: "center" }}>
        <div
          className="mark"
          style={{
            background: "rgba(200, 89, 59, 0.15)",
            color: "var(--brick)",
            border: "1px solid rgba(200, 89, 59, 0.4)",
          }}
          aria-hidden
        >
          !
        </div>
        <h2>Something went wrong</h2>
        <div className="sub">
          The till hit an unexpected error. Try again, or go back to the home
          screen.
        </div>
        <div className="flow-actions">
          <button className="btn primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn ghost">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
