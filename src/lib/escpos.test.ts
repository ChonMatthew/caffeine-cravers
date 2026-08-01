import { describe, expect, it } from "vitest";

import { chunk, encodeReceipt } from "./escpos";

describe("encodeReceipt", () => {
  it("starts with ESC @ (initialize) and ends with paper feed", () => {
    const bytes = encodeReceipt(["HELLO"]);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(bytes.slice(-4))).toEqual([0x0a, 0x0a, 0x0a, 0x0a]);
  });

  it("encodes the text as ASCII in between", () => {
    const bytes = encodeReceipt(["A", "B"]);
    expect(new TextDecoder().decode(bytes)).toContain("A\nB");
  });
});

describe("chunk", () => {
  it("splits into fixed-size pieces, the last one shorter", () => {
    const chunks = chunk(new Uint8Array(45), 20);
    expect(chunks.map((c) => c.length)).toEqual([20, 20, 5]);
  });

  it("returns one exact chunk when evenly divisible", () => {
    expect(chunk(new Uint8Array(40), 20).map((c) => c.length)).toEqual([20, 20]);
  });

  it("rejects a non-positive size", () => {
    expect(() => chunk(new Uint8Array(1), 0)).toThrow();
  });
});
