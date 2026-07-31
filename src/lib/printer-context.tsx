"use client";

// ---------------------------------------------------------------------------
// Printer connection context (Phase 4).
//
// WHY THIS LIVES IN THE (pos) SHELL, ABOVE THE ROUTES:
// The order flow spans several routes (/order -> /order/[id] -> .../pay). A Web
// Bluetooth GATT handle lives only in the current page's JS and is lost on a
// hard reload — but it SURVIVES Next's client-side navigations as long as the
// object is held above the routed subtree. So the provider wraps the shell, the
// app-bar chip reads it, and the operator pairs the printer ONCE per session.
//
// SCOPE: this establishes and holds a real connection (proven in the Phase 0.5
// spike). Building ESC/POS receipt bytes and actually printing is Phase 5 —
// lib/printer.ts will read the held characteristic from here.
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  connectPrinter,
  enumerate,
  pickWritable,
  type FoundChar,
} from "@/lib/ble-probe";

export type PrinterStatus =
  | "unsupported" // no navigator.bluetooth (e.g. Safari) — open in Bluefy
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

type PrinterContextValue = {
  status: PrinterStatus;
  deviceName: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** The live writable characteristic, once connected — for Phase 5 to print. */
  characteristicRef: React.RefObject<FoundChar | null>;
};

const PrinterContext = createContext<PrinterContextValue | null>(null);

export function PrinterProvider({ children }: { children: ReactNode }) {
  // Render the SSR snapshot (false) then the real client value after hydration,
  // without a setState-in-effect hydration mismatch.
  const supported = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && "bluetooth" in navigator,
    () => false,
  );

  const [status, setStatus] = useState<PrinterStatus>("disconnected");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live BLE objects aren't serialisable and shouldn't drive rendering -> refs.
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const characteristicRef = useRef<FoundChar | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const { device, server } = await connectPrinter(() => {});
      deviceRef.current = device;
      device.addEventListener("gattserverdisconnected", () => {
        characteristicRef.current = null;
        setStatus("disconnected");
        setDeviceName(null);
      });

      const target = pickWritable(await enumerate(server, () => {}));
      if (!target) {
        throw new Error("Connected, but found no writable characteristic.");
      }
      characteristicRef.current = target;
      setDeviceName(device.name ?? "Printer");
      setStatus("connected");
    } catch (err) {
      characteristicRef.current = null;
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const disconnect = useCallback(() => {
    deviceRef.current?.gatt?.disconnect();
    characteristicRef.current = null;
    deviceRef.current = null;
    setDeviceName(null);
    setStatus("disconnected");
  }, []);

  const value = useMemo<PrinterContextValue>(
    () => ({
      status: supported ? status : "unsupported",
      deviceName,
      error,
      connect,
      disconnect,
      characteristicRef,
    }),
    [supported, status, deviceName, error, connect, disconnect],
  );

  return (
    <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>
  );
}

export function usePrinter(): PrinterContextValue {
  const ctx = useContext(PrinterContext);
  if (!ctx) {
    throw new Error("usePrinter must be used within <PrinterProvider>.");
  }
  return ctx;
}
