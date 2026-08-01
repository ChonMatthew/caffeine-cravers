// BLE transport — the one place that actually writes to the printer. Promoted
// from the Phase 0.5 spike with the verified MPT-II parameters hardcoded
// (docs/printer-notes.md). The connection itself is owned by printer-context
// (the app-bar chip); this just pushes bytes down a live characteristic.

import { chunk } from "@/lib/escpos";

// Verified working config (docs/printer-notes.md).
export const PRINTER_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
export const PRINTER_WRITE_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";
const CHUNK_SIZE = 20; // bytes per BLE write
const CHUNK_DELAY_MS = 25; // pause so the printer buffer can drain

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Write a receipt byte stream to a connected characteristic in small, paced
 * chunks. One big write silently truncates on these cheap printers, so we chunk
 * to 20 bytes and wait 25ms between each, using write-WITH-response (flow
 * controlled, won't drop bytes).
 */
export async function writeToPrinter(
  characteristic: BluetoothRemoteGATTCharacteristic,
  bytes: Uint8Array,
): Promise<void> {
  for (const piece of chunk(bytes, CHUNK_SIZE)) {
    // Copy into a fresh ArrayBuffer-backed frame so the Web Bluetooth
    // BufferSource type is satisfied (and never a SharedArrayBuffer view).
    const frame = new Uint8Array(piece.length);
    frame.set(piece);
    await characteristic.writeValueWithResponse(frame);
    await sleep(CHUNK_DELAY_MS);
  }
}
