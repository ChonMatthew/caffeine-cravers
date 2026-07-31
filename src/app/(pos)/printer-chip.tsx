"use client";

// The app-bar printer status chip. Tap to pair (Web Bluetooth requires a user
// gesture). Works in ANY browser that exposes navigator.bluetooth — Chrome,
// Edge, and Bluefy on iPad; only iPad Safari has no Web Bluetooth. Connection
// state is held above the routes in PrinterProvider so it survives the order
// flow's navigations. Actual receipt printing is wired in Phase 5.

import { usePrinter } from "@/lib/printer-context";

export function PrinterChip() {
  const { status, deviceName, connect, disconnect } = usePrinter();

  const label = {
    unsupported: "Printer · no Bluetooth",
    disconnected: "Connect printer",
    connecting: "Connecting…",
    connected: deviceName ?? "Printer",
    error: "Printer · retry",
  }[status];

  const onClick = () => {
    if (status === "connected") disconnect();
    else if (status !== "connecting" && status !== "unsupported") connect();
  };

  const title =
    status === "unsupported"
      ? "This browser has no Web Bluetooth. Use Chrome/Edge on desktop, or Bluefy on iPad (Safari doesn't support it)."
      : status === "connected"
        ? `Connected to ${deviceName}. Tap to disconnect.`
        : "Pair the thermal printer.";

  return (
    <button
      type="button"
      className="pstat"
      data-state={status}
      onClick={onClick}
      disabled={status === "unsupported" || status === "connecting"}
      title={title}
    >
      <span className="g" aria-hidden />
      {label}
    </button>
  );
}
