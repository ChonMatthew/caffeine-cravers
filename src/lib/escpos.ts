// Pure ESC/POS byte building. Text lines in, a Uint8Array of printer bytes out,
// plus the chunker the BLE transport needs. No I/O here — printer.ts does the
// writing. Kept pure so the byte stream is unit-testable.

const ESC = 0x1b;

/**
 * Turn 32-col receipt lines into an ESC/POS byte stream:
 *   ESC @ (initialize)  +  the text (ASCII, LF-separated)  +  a few blank lines
 * so the last line clears the tear bar. No cut command — the MPT-II spike fed
 * paper rather than cutting, and a bad cut byte can jam.
 */
export function encodeReceipt(lines: string[]): Uint8Array {
  const init = [ESC, 0x40]; // ESC @
  // TextEncoder emits UTF-8; our receipt text is ASCII, which encodes 1:1.
  const body = new TextEncoder().encode(lines.join("\n") + "\n\n\n\n");
  const out = new Uint8Array(init.length + body.length);
  out.set(init, 0);
  out.set(body, init.length);
  return out;
}

/**
 * Split bytes into fixed-size chunks. BLE's default payload is ~20 bytes and the
 * printer's buffer is tiny, so one big write gets truncated — the transport
 * writes these chunks with a small delay between each.
 */
export function chunk(bytes: Uint8Array, size: number): Uint8Array[] {
  if (size <= 0) throw new Error("chunk size must be positive");
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.slice(offset, offset + size));
  }
  return chunks;
}
