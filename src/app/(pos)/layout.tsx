import { PosShell } from "./pos-shell";

// Shared frame for every protected (pos) screen. Access is gated by proxy.ts
// (redirect) and enforced by requireSession() in the data layer; PosShell is
// just the chrome (app bar, nav, printer chip, clock, Lock).
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <PosShell>{children}</PosShell>;
}
