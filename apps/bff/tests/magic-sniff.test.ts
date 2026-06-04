import { describe, expect, it } from "vitest";
import { sniffMime } from "../src/platform/attachments/magic-sniff";

/**
 * J.5 — magic-sniff.ts unit tests.
 * 6+ cases: each format magic match; mismatched ext+content; truncated buffer.
 */

// Minimal PNG: 8-byte signature + minimal IHDR chunk (13 bytes data) + IDAT + IEND
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Minimal JPEG: SOI + APP0 marker header
const JPG_SIG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
// GIF87a header
const GIF87_SIG = Buffer.from("GIF87a", "ascii");
// GIF89a header
const GIF89_SIG = Buffer.from("GIF89a", "ascii");
// Minimal SVG string
const SVG_CONTENT = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
);
// SVG with XML declaration
const SVG_WITH_XML = Buffer.from(
  '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>',
);

describe("sniffMime", () => {
  it("detects PNG by magic bytes", () => {
    const buf = Buffer.concat([PNG_SIG, Buffer.alloc(100)]);
    expect(sniffMime(buf)).toBe("image/png");
  });

  it("detects JPEG by FF D8 FF magic", () => {
    const buf = Buffer.concat([JPG_SIG, Buffer.alloc(100)]);
    expect(sniffMime(buf)).toBe("image/jpeg");
  });

  it("detects GIF87a by ASCII header", () => {
    const buf = Buffer.concat([GIF87_SIG, Buffer.alloc(100)]);
    expect(sniffMime(buf)).toBe("image/gif");
  });

  it("detects GIF89a by ASCII header", () => {
    const buf = Buffer.concat([GIF89_SIG, Buffer.alloc(100)]);
    expect(sniffMime(buf)).toBe("image/gif");
  });

  it("detects SVG by <svg tag", () => {
    expect(sniffMime(SVG_CONTENT)).toBe("image/svg+xml");
  });

  it("detects SVG with XML declaration", () => {
    expect(sniffMime(SVG_WITH_XML)).toBe("image/svg+xml");
  });

  it("returns null for truncated PNG (only 4 bytes)", () => {
    const buf = PNG_SIG.subarray(0, 4);
    // 4 bytes: not enough for PNG (needs 8), not JPEG (FF D8 FF missing 3rd), not GIF (6), not SVG
    expect(sniffMime(buf)).toBeNull();
  });

  it("returns null for empty buffer", () => {
    expect(sniffMime(Buffer.alloc(0))).toBeNull();
  });

  it("returns null for random binary (e.g. EXE/ZIP magic)", () => {
    // ZIP/EXE starts with 50 4B 03 04 (PK\x03\x04)
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);
    expect(sniffMime(buf)).toBeNull();
  });

  it("does not confuse JPEG header with PNG even if remaining bytes differ", () => {
    // FF D8 FF (JPEG) followed by PNG bytes should still be JPEG
    const buf = Buffer.concat([JPG_SIG, PNG_SIG]);
    expect(sniffMime(buf)).toBe("image/jpeg");
  });

  it("detects SVG case-insensitively (<SVG with uppercase)", () => {
    const buf = Buffer.from("<SVG xmlns='http://www.w3.org/2000/svg'></SVG>");
    expect(sniffMime(buf)).toBe("image/svg+xml");
  });
});
