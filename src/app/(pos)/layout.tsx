import { getCurrentShop } from "@/lib/dal";

import { PosShell } from "./pos-shell";

// Shared frame for every protected (pos) screen. Access is gated by proxy.ts
// (redirect) and enforced by requireSession() in the data layer; PosShell is
// just the chrome (app bar, nav, printer chip, clock, Lock). The current shop's
// name rides in the bar on every screen — the guard against trading a day under
// the wrong shop on a 30-day session.
export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shop = await getCurrentShop();
  return <PosShell shopName={shop.name}>{children}</PosShell>;
}
