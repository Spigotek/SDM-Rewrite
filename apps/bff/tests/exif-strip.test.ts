import { describe, expect, it } from "vitest";
import { stripJpgMetadata } from "../src/platform/attachments/exif-strip";

/**
 * J.5 — exif-strip.ts unit tests.
 * 4+ cases: no APP markers, single APP1 with EXIF payload, multiple APPx,
 * no-op for non-JPG buffers (PNG/GIF/SVG).
 */

/** Build a minimal JPEG buffer from segments. Each item is [markerByte, payload?]. */
function buildJpeg(segments: Array<{ marker: number; data?: Buffer }>): Buffer {
  const chunks: Buffer[] = [Buffer.from([0xff, 0xd8])]; // SOI
  for (const seg of segments) {
    if (seg.marker === 0xda) {
      // SOS + image data (no length field)
      chunks.push(Buffer.from([0xff, 0xda]));
      chunks.push(seg.data ?? Buffer.from([0x00]));
      break;
    }
    if (seg.marker >= 0xd0 && seg.marker <= 0xd9) {
      // Standalone
      chunks.push(Buffer.from([0xff, seg.marker]));
      continue;
    }
    // Variable-length: 2-byte length including itself
    const payload = seg.data ?? Buffer.alloc(0);
    const len = payload.length + 2;
    const lenBuf = Buffer.from([(len >> 8) & 0xff, len & 0xff]);
    chunks.push(Buffer.from([0xff, seg.marker]));
    chunks.push(lenBuf);
    chunks.push(payload);
  }
  chunks.push(Buffer.from([0xff, 0xd9])); // EOI
  return Buffer.concat(chunks);
}

/** Extract all marker types from a JPEG buffer (after SOI). */
function extractMarkers(buf: Buffer): number[] {
  const markers: number[] = [];
  let pos = 2; // skip SOI
  while (pos < buf.length) {
    if (buf[pos] !== 0xff) break;
    while (pos < buf.length && buf[pos] === 0xff) pos++;
    if (pos >= buf.length) break;
    const mt = buf[pos++];
    if (mt === undefined) break;
    markers.push(mt);
    if (mt === 0xda || mt === 0xd9) break;
    if ((mt >= 0xd0 && mt <= 0xd7) || mt === 0xd8) continue;
    if (pos + 1 >= buf.length) break;
    const segLen = (buf[pos]! << 8) | buf[pos + 1]!;
    pos += segLen;
  }
  return markers;
}

describe("stripJpgMetadata", () => {
  it("no-op: JPEG with no APP markers passes through unchanged", () => {
    const dqtData = Buffer.alloc(64, 0x10); // dummy quantisation table
    const input = buildJpeg([
      { marker: 0xdb, data: dqtData }, // DQT
      { marker: 0xda, data: Buffer.from([0x12, 0x34]) }, // SOS + image data
    ]);
    const output = stripJpgMetadata(input);
    // DQT and SOS markers should survive
    const markers = extractMarkers(output);
    expect(markers).toContain(0xdb); // DQT kept
    expect(markers).toContain(0xda); // SOS kept
  });

  it("strips single APP1 (EXIF) marker", () => {
    const exifPayload = Buffer.from("Exif\x00\x00" + "A".repeat(100));
    const input = buildJpeg([
      { marker: 0xe1, data: exifPayload }, // APP1 = EXIF
      { marker: 0xda, data: Buffer.from([0xab, 0xcd]) },
    ]);
    const output = stripJpgMetadata(input);
    const markers = extractMarkers(output);
    expect(markers).not.toContain(0xe1); // APP1 stripped
    expect(markers).toContain(0xda); // SOS kept
  });

  it("strips multiple APP markers (APP0, APP1, APP13)", () => {
    const jfifPayload = Buffer.from("JFIF\x00" + "\x01\x01" + "\x00\x00\x01\x00\x01");
    const exifPayload = Buffer.from("Exif\x00\x00" + "B".repeat(50));
    const iptcPayload = Buffer.from("Photoshop 3.0\x00" + "C".repeat(40));
    const input = buildJpeg([
      { marker: 0xe0, data: jfifPayload }, // APP0 = JFIF
      { marker: 0xe1, data: exifPayload }, // APP1 = EXIF
      { marker: 0xed, data: iptcPayload }, // APP13 = IPTC / Photoshop
      { marker: 0xdb, data: Buffer.alloc(64, 0x10) }, // DQT — keep
      { marker: 0xda, data: Buffer.from([0xef, 0xaa]) },
    ]);
    const output = stripJpgMetadata(input);
    const markers = extractMarkers(output);
    expect(markers).not.toContain(0xe0);
    expect(markers).not.toContain(0xe1);
    expect(markers).not.toContain(0xed);
    expect(markers).toContain(0xdb); // DQT kept
    expect(markers).toContain(0xda); // SOS kept
  });

  it("no-op for PNG buffer — returns input unchanged", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(20).fill(0)]);
    const output = stripJpgMetadata(png);
    expect(output).toBe(png); // exact same reference
  });

  it("no-op for GIF buffer", () => {
    const gif = Buffer.from("GIF89a" + "\x01\x00\x01\x00\x80\x00\x00", "binary");
    const output = stripJpgMetadata(gif);
    expect(output).toBe(gif);
  });

  it("no-op for SVG buffer (text)", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const output = stripJpgMetadata(svg);
    expect(output).toBe(svg);
  });

  it("preserves image data after SOS marker", () => {
    const imageData = Buffer.from([0xab, 0xcd, 0xef, 0x12, 0x34]);
    const input = buildJpeg([
      { marker: 0xe1, data: Buffer.from("Exif\x00\x00" + "X".repeat(20)) },
      { marker: 0xda, data: imageData },
    ]);
    const output = stripJpgMetadata(input);
    // The image data bytes must appear somewhere in the output
    const dataStr = output.toString("hex");
    expect(dataStr).toContain(imageData.toString("hex"));
  });
});
