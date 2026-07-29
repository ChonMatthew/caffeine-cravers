"use client";

// ---------------------------------------------------------------------------
// Phase 0.5 BLE printing spike — THROWAWAY diagnostic page (unprotected).
// Goal: print "HELLO WORLD" from an iPad in Bluefy, and record the working
// service UUID / characteristic UUID / chunk size / delay for Phase 5.
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  buildHelloWorldBytes,
  connectPrinter,
  enumerate,
  pickWritable,
  writeChunked,
  type FoundChar,
} from "@/lib/ble-probe";

export default function PrintTestPage() {
  const [logLines, setLogLines] = useState<string[]>([]);
  const [chunkSize, setChunkSize] = useState(20);
  const [delayMs, setDelayMs] = useState(25);
  const [status, setStatus] = useState("Not connected");

  // Read a client-only capability without a hydration mismatch and without
  // setState-in-effect: useSyncExternalStore renders the server snapshot
  // (false) during SSR, then the real client value after hydration.
  const bluetoothSupported = useSyncExternalStore(
    () => () => {}, // nothing external changes, so the subscribe is a no-op
    () => "bluetooth" in navigator, // client snapshot
    () => false, // server snapshot
  );

  // Live Bluetooth objects: not serializable, don't drive rendering -> refs.
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const targetRef = useRef<FoundChar | null>(null);

  // Append a timestamped line to the on-screen log (our devtools on iPad).
  const log = useCallback((message: string) => {
    const t = new Date().toLocaleTimeString();
    setLogLines((prev) => [...prev, `${t}  ${message}`]);
  }, []);

  async function handleConnect() {
    try {
      const { device, server } = await connectPrinter(log);
      deviceRef.current = device;

      // BLE links drop constantly (sleep, power-save). Log it when it happens.
      device.addEventListener("gattserverdisconnected", () => {
        log("⚠ Disconnected.");
        setStatus("Disconnected");
        targetRef.current = null;
      });

      const writable = await enumerate(server, log);
      const target = pickWritable(writable);
      if (!target) {
        setStatus("Connected, but no writable characteristic found");
        log("No writable characteristic — cannot print. See the log above.");
        return;
      }
      targetRef.current = target;
      setStatus(`Ready: ${target.service} / ${target.characteristic}`);
      log(`Using service ${target.service}`);
      log(`Using characteristic ${target.characteristic}`);
    } catch (err) {
      log(`✗ ${err instanceof Error ? err.message : String(err)}`);
      setStatus("Error (see log)");
    }
  }

  async function handlePrint() {
    const target = targetRef.current;
    if (!target) {
      log("✗ Not ready — connect first.");
      return;
    }
    try {
      await writeChunked(target, buildHelloWorldBytes(), chunkSize, delayMs, log);
      log("✓ Sent. Check the paper.");
    } catch (err) {
      log(`✗ Print failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleDisconnect() {
    deviceRef.current?.gatt?.disconnect();
    log("Disconnect requested.");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 p-5">
      <h1 className="text-2xl font-semibold">BLE Printer Test</h1>

      {!bluetoothSupported && (
        <p className="rounded-md bg-red-100 p-3 text-red-900">
          Web Bluetooth is not available in this browser. On iPad, open this page
          in <strong>Bluefy</strong> (Safari does not support it).
        </p>
      )}

      <p className="text-sm text-foreground/70">Status: {status}</p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleConnect}
          className="min-h-12 rounded-lg bg-accent px-5 text-accent-foreground"
        >
          Connect
        </button>
        <button
          onClick={handlePrint}
          className="min-h-12 rounded-lg border border-foreground/20 px-5"
        >
          Print Test
        </button>
        <button
          onClick={handleDisconnect}
          className="min-h-12 rounded-lg border border-foreground/20 px-5"
        >
          Disconnect
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Chunk size: {chunkSize} bytes
        <input
          type="range"
          min={5}
          max={100}
          step={1}
          value={chunkSize}
          onChange={(e) => setChunkSize(Number(e.target.value))}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Delay between chunks: {delayMs} ms
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={delayMs}
          onChange={(e) => setDelayMs(Number(e.target.value))}
        />
      </label>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Log</h2>
        <button
          onClick={() => setLogLines([])}
          className="text-sm text-foreground/60 underline"
        >
          Clear
        </button>
      </div>
      <pre className="h-72 overflow-auto rounded-md bg-black/90 p-3 text-xs leading-5 text-green-300">
        {logLines.length === 0 ? "(no output yet)" : logLines.join("\n")}
      </pre>
    </main>
  );
}
