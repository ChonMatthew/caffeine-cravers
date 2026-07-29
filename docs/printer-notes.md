# Printer notes — MPT-II thermal printer (58mm, BLE)

Findings from the Phase 0.5 Web Bluetooth spike (`app/print-test`, `lib/ble-probe.ts`),
tested on an iPad in **Bluefy**. These are the values Phase 5 (`lib/printer.ts`) hardcodes.

## Verified working configuration

| Setting | Value |
|---|---|
| Device name (advertised) | `MPT-II_30D4` (suffix varies per unit) |
| Transport | **Bluetooth Low Energy (BLE)** — confirmed, NOT Bluetooth Classic |
| Service (short / canonical) | `18F0` → `000018f0-0000-1000-8000-00805f9b34fb` |
| Write characteristic (short / canonical) | `2AF1` → `00002af1-0000-1000-8000-00805f9b34fb` |
| Write mode | `writeValueWithResponse` (characteristic reports `write=true` and `writeWithoutResponse=true`) |
| Chunk size | 20 bytes |
| Inter-chunk delay | 25 ms |
| Encoding | ASCII via `TextEncoder` (UTF-8, ASCII subset) |
| Init command | `ESC @` = `0x1B 0x40` |

Printed "HELLO WORLD" successfully; reconnect after disconnect also works.

## Browser support

- **Bluefy (iPad):** works.
- **Safari (iOS):** no `navigator.bluetooth` — the capability banner fires. Expected; Safari has no Web Bluetooth.

## Full service/characteristic map (for reference)

Five primary services were discovered; six writable characteristics total. We use
the first (`18F0`/`2AF1`, the standard thermal-printer service). Others are
fallbacks if a future firmware revision differs.

```
service 18F0
  char 2AF0  notify
  char 2AF1  write, writeNoResp          <-- USED
service FEE7
  char FEC8  (none)
  char FEC7  write, writeNoResp
service FF00
  char FF01  notify
  char FF02  write, writeNoResp          <-- fallback (generic clones)
  char FF03  notify
service E7810A71-73AE-499D-8C15-FAA9AEF0C3F2
  char BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F  write, writeNoResp, notify
service 49535343-FE7D-4AE5-8FA9-9FAFD205E455   (Microchip/ISSC UART)
  char 49535343-1E4D-4BD9-BA61-23C647249616  notify
  char 49535343-8841-43F4-A8D4-ECBE34729BB3  write, writeNoResp   <-- fallback
  char 49535343-ACA3-481C-91EC-D85E28A60318  write, notify
```

## Gotchas observed

- Tapping **Connect** while already connected throws a terse error (`✗ 2`). Phase 5
  must guard against connecting when a live GATT connection already exists.
- Bluefy reports standard UUIDs in short 16-bit form (`18F0`), not the full
  128-bit string. Web Bluetooth accepts either form when requesting.
- Do NOT pair the printer at the OS level (iOS Settings → Bluetooth) — that can
  block the browser from acquiring it via GATT.
