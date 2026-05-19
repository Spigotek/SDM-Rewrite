import { describe, expect, it } from "vitest";
import { priorityWeight, rawToUiQueueItem } from "../../../src/aggregator/shapers/ui-queue-item";

const INCIDENT_RAW = {
  "@id": 2800,
  "@COMMON_NAME": "SD:01",
  ref_num: "SD:01",
  summary: "Summary Service Desk Incident None",
  description: "desc",
  open_date: "1031839200",
  close_date: "0",
  active: { "@id": 200, "@REL_ATTR": "0", "@COMMON_NAME": "NO" },
  priority: { "@id": 503, "@REL_ATTR": 2, "@COMMON_NAME": 2 },
  status: { "@id": 5201, "@REL_ATTR": "CL", "@COMMON_NAME": "Uzatvorený" },
  customer: { "@id": "U'793ED'", "@COMMON_NAME": "System_AHD" },
};

const REQUEST_RAW = {
  "@id": 2851,
  ref_num: "SA:01",
  summary: "req sum",
  description: "",
  type: { "@id": 180, "@REL_ATTR": "R", "@COMMON_NAME": "Request" },
  priority: { "@id": 505, "@REL_ATTR": 0, "@COMMON_NAME": "None" },
  status: { "@id": 5200, "@REL_ATTR": "OP", "@COMMON_NAME": "Vytvorený" },
  open_date: "1700000000",
};

const PROBLEM_RAW = {
  "@id": 406621,
  "@COMMON_NAME": 5254,
  ref_num: 5254,
  priority: { "@id": 502, "@REL_ATTR": 3, "@COMMON_NAME": 3 },
  status: { "@id": 5200, "@REL_ATTR": "OP", "@COMMON_NAME": "Vytvorený" },
  open_date: "1727771897",
};

describe("rawToUiQueueItem", () => {
  it("incident: collapses FKs and sets ticketType", () => {
    const item = rawToUiQueueItem(INCIDENT_RAW, "incident");
    expect(item.ticketType).toBe("incident");
    expect(item.id).toBe("2800");
    expect(item.ref).toBe("SD:01");
    expect(item.status?.code).toBe("CL");
    expect(item.priority?.code).toBe("2");
    expect(item.customer?.label).toBe("System_AHD");
    expect(item.openedAt).toBe(new Date(1031839200 * 1000).toISOString());
    expect(item.lastActivityAt).toBe(item.openedAt);
  });

  it("request: ticketType=request, preserves CA SDM numeric ref coercion", () => {
    const item = rawToUiQueueItem(REQUEST_RAW, "request");
    expect(item.ticketType).toBe("request");
    expect(item.ref).toBe("SA:01");
    expect(item.priority?.code).toBe("0");
  });

  it("problem: numeric ref_num coerced to string (§14)", () => {
    const item = rawToUiQueueItem(PROBLEM_RAW, "problem");
    expect(item.ticketType).toBe("problem");
    expect(item.ref).toBe("5254");
    expect(item.priority?.code).toBe("3");
  });

  it("throws on change (not in queue scope)", () => {
    expect(() => rawToUiQueueItem({}, "change")).toThrow(/change rows/);
  });
});

describe("priorityWeight", () => {
  it("inverts CA SDM 1..5 so larger weight = higher priority", () => {
    const p1 = priorityWeight({ priority: { id: "", code: "1", label: "" } } as never);
    const p5 = priorityWeight({ priority: { id: "", code: "5", label: "" } } as never);
    expect(p1).toBeGreaterThan(p5);
  });

  it("missing or '0' priority sinks to weight 0", () => {
    expect(priorityWeight({ priority: null } as never)).toBe(0);
    expect(priorityWeight({ priority: { id: "", code: "0", label: "" } } as never)).toBe(0);
  });
});
