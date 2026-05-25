import { describe, expect, it } from "vitest";
import { mapActivityRow } from "../../../src/api/endpoints/activity-log";

describe("mapActivityRow", () => {
  it("INIT type, internal=0 → kind=system", () => {
    const out = mapActivityRow({
      "@id": 408536,
      description: "create",
      analyst: { "@id": "U'A'", "@COMMON_NAME": "A" },
      internal: 0,
      time_stamp: 1727771897,
      type: { "@id": 5602, "@REL_ATTR": "INIT", "@COMMON_NAME": "Initial" },
    });
    expect(out.id).toBe("408536");
    expect(out.kind).toBe("system");
    expect(out.text).toBe("create");
    expect(out.author?.label).toBe("A");
    expect(out.createdAt).toBe(new Date(1727771897 * 1000).toISOString());
  });

  it("LOG type, internal=0 → kind=public", () => {
    const out = mapActivityRow({
      "@id": 1,
      description: "hello",
      internal: 0,
      type: { "@id": 5601, "@REL_ATTR": "LOG" },
    });
    expect(out.kind).toBe("public");
  });

  it("LOG type, internal=1 → kind=internal (override wins)", () => {
    const out = mapActivityRow({
      "@id": 1,
      description: "secret",
      internal: 1,
      type: { "@id": 5601, "@REL_ATTR": "LOG" },
    });
    expect(out.kind).toBe("internal");
  });

  it("falls back to action_desc when description is empty", () => {
    const out = mapActivityRow({
      "@id": 1,
      description: "",
      action_desc: "transfer assignee",
      type: { "@id": 5600, "@REL_ATTR": "TR" },
    });
    expect(out.text).toBe("transfer assignee");
    expect(out.kind).toBe("system");
  });

  it("missing time_stamp → createdAt null", () => {
    const out = mapActivityRow({
      "@id": 1,
      description: "x",
      type: { "@id": 5601, "@REL_ATTR": "LOG" },
    });
    expect(out.createdAt).toBeNull();
  });

  it("missing analyst FK → author null", () => {
    const out = mapActivityRow({
      "@id": 1,
      description: "x",
      type: { "@id": 5601, "@REL_ATTR": "LOG" },
    });
    expect(out.author).toBeNull();
  });
});
