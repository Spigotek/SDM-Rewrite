/**
 * Hand-rolled JPEG APP-marker strip.
 *
 * Removes APP0–APP15 markers (FF E0 – FF EF) which carry EXIF (APP1),
 * IPTC (APP13), XMP (APP1 alternate), Photoshop (APP13), ICC profiles
 * (APP2), and various vendor-specific metadata.
 *
 * Algorithm:
 *   1. Verify SOI magic (FF D8). Non-JPEG input is returned unchanged.
 *   2. Walk the marker stream. Each JFIF marker has the form:
 *        FF <type-byte> <length-high> <length-low> <payload…>
 *      where length includes the two length bytes themselves.
 *   3. Drop APP markers (type byte in E0–EF range). Copy all other
 *      segments (DQT, DHT, SOF, COM, …) to the output.
 *   4. Stop scanning when we hit SOS (FF DA) — the compressed image data
 *      follows and is not marker-structured. Copy everything from SOS
 *      to EOF verbatim.
 *
 * Limitation (documented per J.5 plan): metadata embedded inside the JPEG
 * compressed bitstream (extremely rare; vendor-proprietary) is not stripped.
 * This covers the relevant privacy vectors: EXIF GPS, IPTC credit, XMP.
 */
export function stripJpgMetadata(buf: Buffer): Buffer {
  // SOI check: JPEG starts with FF D8
  if (buf.length < 2 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return buf; // not JPEG — no-op
  }

  const chunks: Buffer[] = [];
  // Always keep the SOI marker.
  chunks.push(buf.subarray(0, 2));

  let pos = 2;

  while (pos < buf.length) {
    // Expect an 0xFF byte starting each marker.
    if (buf[pos] !== 0xff) {
      // Corrupt / truncated — just copy the rest verbatim.
      chunks.push(buf.subarray(pos));
      break;
    }

    // Skip fill bytes (0xFF padding before the marker byte).
    while (pos < buf.length && buf[pos] === 0xff) pos++;
    if (pos >= buf.length) break;

    const markerByte = buf[pos++];
    if (markerByte === undefined) break;
    const markerType: number = markerByte;

    // SOS (FF DA) — image data starts; copy to EOF and stop.
    if (markerType === 0xda) {
      chunks.push(Buffer.from([0xff, 0xda]));
      chunks.push(buf.subarray(pos));
      break;
    }

    // EOI (FF D9) — end of image.
    if (markerType === 0xd9) {
      chunks.push(Buffer.from([0xff, 0xd9]));
      break;
    }

    // Standalone markers (no length field): RST0–RST7, SOI, EOI.
    if ((markerType >= 0xd0 && markerType <= 0xd7) || markerType === 0xd8) {
      if (markerType !== 0xd8) {
        // skip duplicate SOI
        chunks.push(Buffer.from([0xff, markerType]));
      }
      continue;
    }

    // Variable-length segment: read 2-byte length (includes itself).
    if (pos + 1 >= buf.length) break; // truncated
    const segLen = (buf[pos]! << 8) | buf[pos + 1]!;
    if (segLen < 2) break; // corrupt
    const segEnd = pos + segLen;
    const segData = buf.subarray(pos, Math.min(segEnd, buf.length)); // includes length bytes

    // APP markers: E0–EF → drop (strip EXIF / IPTC / XMP / vendor metadata).
    if (markerType >= 0xe0 && markerType <= 0xef) {
      pos = segEnd;
      continue;
    }

    // All other segments (DQT, DHT, SOF0-SOFn, COM, DRI, …) → keep.
    chunks.push(Buffer.from([0xff, markerType]));
    chunks.push(segData);
    pos = segEnd;
  }

  return Buffer.concat(chunks);
}
