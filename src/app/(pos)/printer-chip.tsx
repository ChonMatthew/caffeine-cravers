"use client";

// The app-bar printer control. Compact by design: an icon + a status-colour
// dot, no label — the bar has no room to spare for text (see globals.css
// .pbtn). Tap opens a small modal with the full status and the connect/
// disconnect action; Web Bluetooth requires a user gesture, so that button
// inside the modal is what actually triggers the pairing prompt. Works in any
// browser that exposes navigator.bluetooth — Chrome, Edge, and Bluefy on
// iPad; only iPad Safari has no Web Bluetooth. Connection state is held above
// the routes in PrinterProvider so it survives the order flow's navigations.

import { useEffect, useState } from "react";

import { usePrinter } from "@/lib/printer-context";

const STATUS_TEXT: Record<string, string> = {
  unsupported: "No Web Bluetooth in this browser.",
  disconnected: "Not connected.",
  connecting: "Connecting…",
  connected: "Connected.",
  error: "Connection failed.",
};

export function PrinterButton() {
  const { status, deviceName, error, connect, disconnect } = usePrinter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const title =
    status === "connected"
      ? `Printer connected: ${deviceName}`
      : status === "unsupported"
        ? "Printer — no Bluetooth support in this browser"
        : "Printer";

  return (
    <>
      <button
        type="button"
        className="pbtn"
        data-state={status}
        onClick={() => setOpen(true)}
        title={title}
        aria-label={title}
      >
        <svg className="picon" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 9V4h12v5" />
          <rect x="4" y="9" width="16" height="8" rx="1.5" />
          <rect x="7" y="14" width="10" height="6" rx="1" />
        </svg>
        <span className="pdot" aria-hidden />
      </button>

      {open && (
        <div
          className="scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="modal pmodal"
            role="dialog"
            aria-modal="true"
            aria-label="Printer"
          >
            <div className="m-head">
              <h3>Printer</h3>
            </div>
            <div className="m-body">
              <div className="prow">
                <div className="prow-info">
                  <span className="pdot lg" data-state={status} aria-hidden />
                  <div>
                    <div className="prow-name">{deviceName ?? "Thermal printer"}</div>
                    <div className="prow-status">
                      {status === "error" && error ? error : STATUS_TEXT[status]}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="pmodal-btn"
                  disabled={status === "unsupported" || status === "connecting"}
                  onClick={() => (status === "connected" ? disconnect() : connect())}
                >
                  {status === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>
              {status === "unsupported" && (
                <p className="prow-hint">
                  Open this app in Bluefy on iPad, or use Chrome/Edge on desktop —
                  Safari has no Web Bluetooth support.
                </p>
              )}
            </div>
            <div className="m-foot">
              <button type="button" className="m-cancel" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
