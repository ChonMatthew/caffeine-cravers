// ---------------------------------------------------------------------------
// BLE printing spike helpers (Phase 0.5, throwaway).
// All Web Bluetooth I/O lives here so the React page stays a thin UI shell.
// Once we know the real UUIDs, this graduates into lib/printer.ts in Phase 5.
// ---------------------------------------------------------------------------

// A simple logging callback the UI passes in, so this module never touches React.
export type LogFn = (message: string) => void;

// Services we're allowed to "see" after connecting. Web Bluetooth hides any
// service you didn't declare here, so this list is our net for cheap 58mm
// printers. The first one is the most likely for MPT-II / Goojprt / ZJ-58.
export const PRINTER_SERVICE_CANDIDATES: string[] = [
  "000018f0-0000-1000-8000-00805f9b34fb", // most common thermal-printer service
  "0000ff00-0000-1000-8000-00805f9b34fb", // generic clones
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 serial modules
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip/ISSC transparent UART
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
];

// One writable characteristic we discovered on the device.
export interface FoundChar {
  service: string;
  characteristic: string;
  write: boolean; // supports writeValueWithResponse (flow-controlled, safer)
  writeWithoutResponse: boolean; // faster, but can drop bytes if you outrun it
  ref: BluetoothRemoteGATTCharacteristic; // the live object we actually write to
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reset the printer to a known state. ESC @ (0x1B 0x40) = "initialize".
// Every receipt should start with this.
export function buildHelloWorldBytes(): Uint8Array {
  const ESC = 0x1b;
  const init = new Uint8Array([ESC, 0x40]); // ESC @
  // TextEncoder emits UTF-8; ASCII text encodes 1:1, which the printer speaks.
  const body = new TextEncoder().encode("HELLO WORLD\n\n\n\n");
  const out = new Uint8Array(init.length + body.length);
  out.set(init, 0);
  out.set(body, init.length);
  return out;
}

// Prompt the OS device chooser and open a GATT connection.
// MUST be called from a user gesture (a click handler) — the browser rejects it
// otherwise. That's why the UI calls this straight from onClick, never useEffect.
export async function connectPrinter(
  log: LogFn,
): Promise<{ device: BluetoothDevice; server: BluetoothRemoteGATTServer }> {
  if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
    throw new Error(
      "Web Bluetooth is unavailable. On iPad, open this page in Bluefy — Safari does not support it.",
    );
  }

  log("Opening device chooser — pick your printer…");
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true, // we don't know the name, so show everything
    optionalServices: PRINTER_SERVICE_CANDIDATES,
  });
  log(`Selected: ${device.name ?? "(unnamed)"}  id=${device.id}`);

  if (!device.gatt) {
    throw new Error("This device exposes no GATT server (not a BLE device?).");
  }

  log("Connecting to GATT server…");
  const server = await device.gatt.connect();
  log("GATT connected.");
  return { device, server };
}

// Walk every service and characteristic and report what we find.
// Returns only the WRITABLE characteristics — those are the print candidates.
export async function enumerate(
  server: BluetoothRemoteGATTServer,
  log: LogFn,
): Promise<FoundChar[]> {
  const writable: FoundChar[] = [];

  const services = await server.getPrimaryServices();
  log(`Discovered ${services.length} primary service(s).`);
  if (services.length === 0) {
    log(
      "No services visible. The printer's service UUID may not be in our candidate list — note its details and we'll add it.",
    );
  }

  for (const service of services) {
    log(`service ${service.uuid}`);
    const characteristics = await service.getCharacteristics();
    for (const ch of characteristics) {
      const p = ch.properties;
      log(
        `  char ${ch.uuid}  write=${p.write}  writeNoResp=${p.writeWithoutResponse}  notify=${p.notify}`,
      );
      if (p.write || p.writeWithoutResponse) {
        writable.push({
          service: service.uuid,
          characteristic: ch.uuid,
          write: p.write,
          writeWithoutResponse: p.writeWithoutResponse,
          ref: ch,
        });
      }
    }
  }

  log(`Found ${writable.length} writable characteristic(s).`);
  return writable;
}

// Prefer a characteristic that supports write-with-response (flow-controlled,
// won't drop bytes). Fall back to write-without-response only if that's all
// there is.
export function pickWritable(found: FoundChar[]): FoundChar | undefined {
  return found.find((c) => c.write) ?? found.find((c) => c.writeWithoutResponse);
}

// Send bytes in small, paced chunks. This is the part that silently fails if
// you get it wrong: BLE's default payload is ~20 bytes and the printer's buffer
// is tiny, so one big write gets truncated into garbage. Chunk + await + sleep.
export async function writeChunked(
  target: FoundChar,
  bytes: Uint8Array,
  chunkSize: number,
  delayMs: number,
  log: LogFn,
): Promise<void> {
  const useResponse = target.write; // safer mode when available
  const chunks = Math.ceil(bytes.length / chunkSize);
  log(
    `Writing ${bytes.length} bytes as ${chunks} chunk(s) of ${chunkSize}B, ${delayMs}ms apart, mode=${useResponse ? "withResponse" : "withoutResponse"}`,
  );

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    if (useResponse) {
      await target.ref.writeValueWithResponse(chunk);
    } else {
      await target.ref.writeValueWithoutResponse(chunk);
    }
    await sleep(delayMs); // give the printer time to drain its buffer
  }

  log("Write complete.");
}
