import Link from "next/link";

import { logout } from "./actions";

// Shared shell for every protected (pos) screen: nav + Lock button.
// Access is gated by proxy.ts (redirect) and enforced by requireSession() in
// the data layer; this layout is just chrome.
export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <nav className="flex items-center gap-4 border-b border-foreground/10 p-3">
        <span className="font-semibold">Caffeine Cravers</span>
        <Link href="/print-test" className="text-sm text-foreground/70">
          Printer
        </Link>
        <form action={logout} className="ml-auto">
          <button className="rounded-md border border-foreground/20 px-3 py-1 text-sm">
            Lock
          </button>
        </form>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
