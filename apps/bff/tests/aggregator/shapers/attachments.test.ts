import { describe, expect, it } from "vitest";
import { extractAttachmentIds, mapAttmntRow } from "../../../src/api/endpoints/attachments";

describe("mapAttmntRow", () => {
  it("maps file_name, file_size, file_type → mime, last_mod_dt → uploadedAt", () => {
    const out = mapAttmntRow({
      "@id": 400059,
      file_name: "printer.jpg.gz",
      file_type: "jpg",
      file_size: 27066,
      last_mod_dt: 1619005806,
    });
    expect(out).toEqual({
      id: "400059",
      name: "printer.jpg.gz",
      mime: "image/jpeg",
      sizeBytes: 27066,
      uploadedAt: new Date(1619005806 * 1000).toISOString(),
    });
  });

  it("unknown file_type → mime null", () => {
    const out = mapAttmntRow({
      "@id": 1,
      file_name: "blob.weirdext",
      file_type: "weirdext",
      file_size: 100,
      last_mod_dt: 1700000000,
    });
    expect(out.mime).toBeNull();
  });

  it("missing file_size → sizeBytes null", () => {
    const out = mapAttmntRow({ "@id": 1, file_name: "x.pdf", file_type: "pdf" });
    expect(out.sizeBytes).toBeNull();
    expect(out.mime).toBe("application/pdf");
  });

  it("missing file_name → empty string (not undefined)", () => {
    const out = mapAttmntRow({ "@id": 1, file_type: "pdf" });
    expect(out.name).toBe("");
  });

  it("case-insensitive file_type mapping (UPPER)", () => {
    const out = mapAttmntRow({ "@id": 1, file_name: "X.PDF", file_type: "PDF" });
    expect(out.mime).toBe("application/pdf");
  });
});

describe("extractAttachmentIds", () => {
  it("pulls attmnt.@id from each lrel join row", () => {
    const ids = extractAttachmentIds([
      { "@id": 400001, attmnt: { "@id": 400059, "@COMMON_NAME": 1619005790 } },
      { "@id": 400051, attmnt: { "@id": 400151 } },
    ]);
    expect(ids).toEqual(["400059", "400151"]);
  });

  it("skips rows without attmnt FK", () => {
    const ids = extractAttachmentIds([
      { "@id": 1, attmnt: { "@id": 100 } },
      { "@id": 2 },
      { "@id": 3, attmnt: { "@COMMON_NAME": "no-id" } as Record<string, unknown> },
    ]);
    expect(ids).toEqual(["100"]);
  });

  it("empty array in → empty array out", () => {
    expect(extractAttachmentIds([])).toEqual([]);
  });
});
