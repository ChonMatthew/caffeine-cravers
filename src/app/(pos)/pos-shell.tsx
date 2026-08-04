"use client";

// The app frame every protected screen shares: brand, nav, printer chip, clock,
// Lock. It's a client component because the nav highlights the current route,
// the clock ticks, and it owns the printer-connection context that the order
// flow reads across routes. Access itself is enforced by proxy.ts +
// requireSession() — this is just chrome.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

import { PrinterProvider } from "@/lib/printer-context";

import { logout } from "./actions";
import { PrinterChip } from "./printer-chip";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/order", label: "Order" },
  { href: "/recent", label: "Recent" },
  { href: "/catalog", label: "Catalog" },
  { href: "/reports", label: "Report" },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Tick every second via an external store: getSnapshot returns a value that
// only changes when the second changes (so React doesn't loop), the server
// snapshot is null (no hydration mismatch), and there's no setState in an effect.
let clockCache = { sec: 0, at: 0 };
function clockSnapshot(): number {
  const sec = Math.floor(Date.now() / 1000);
  if (sec !== clockCache.sec) clockCache = { sec, at: Date.now() };
  return clockCache.sec;
}
function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}

function Clock() {
  const sec = useSyncExternalStore(
    subscribeClock,
    clockSnapshot,
    () => 0, // server snapshot
  );
  // Render nothing until the client has a real second, so markup matches on SSR.
  if (sec === 0) return <div className="clock" aria-hidden />;
  const now = new Date(sec * 1000);
  const date = now.toLocaleDateString("en-MY", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const time = now.toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return (
    <div className="clock">
      {date} <span className="dot">·</span> {time}
    </div>
  );
}

export function PosShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <PrinterProvider>
      <div className="app">
        <header className="bar">
          <div className="brand">
            <span className="bean" aria-hidden />
            Caffeine Cravers
          </div>
          <nav className="nav">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isCurrent(pathname, n.href) ? "page" : undefined}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="bar-right">
            <PrinterChip />
            <Clock />
            <form action={logout}>
              <button className="lock" title="Lock the till">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                Lock
              </button>
            </form>
          </div>
        </header>
        <div className="stage">{children}</div>
      </div>
    </PrinterProvider>
  );
}
