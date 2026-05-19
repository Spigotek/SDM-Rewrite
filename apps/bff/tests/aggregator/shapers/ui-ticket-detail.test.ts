import { describe, expect, it } from "vitest";
import { rawToUiTicketDetail } from "../../../src/aggregator/shapers/ui-ticket-detail";

describe("rawToUiTicketDetail", () => {
  it("incident: shape includes empty linked/attachments/activity with _unsupported markers", () => {
    const detail = rawToUiTicketDetail(
      {
        "@id": 2800,
        ref_num: "SD:01",
        summary: "x",
        description: "y",
        status: { "@id": 5201, "@REL_ATTR": "CL", "@COMMON_NAME": "Uzatvorený" },
        open_date: "1031839200",
      },
      "incident",
    );
    expect(detail.ticketType).toBe("incident");
    expect(detail.ref).toBe("SD:01");
    expect(detail.linked._unsupported).toBe(true);
    expect(detail.linked.problems).toEqual([]);
    expect(detail.attachments._unsupported).toBe(true);
    expect(detail.activity._unsupported).toBe(true);
    expect(detail.activity.hasMore).toBe(false);
  });

  it("change: uses chg schema (chg_ref_num, requestor not customer)", () => {
    const detail = rawToUiTicketDetail(
      {
        "@id": 2781,
        chg_ref_num: "USD:11",
        summary: "ITIL summary",
        description: "",
        requestor: { "@id": "U'FCF'", "@COMMON_NAME": "System_MA_User" },
        status: { "@id": 6001, "@REL_ATTR": "CL", "@COMMON_NAME": "Closed" },
        open_date: "1031839200",
      },
      "change",
    );
    expect(detail.ref).toBe("USD:11");
    expect(detail.customer?.label).toBe("System_MA_User");
    expect(detail.status?.code).toBe("CL");
  });

  it("problem: numeric ref coerced + empty arrays present", () => {
    const detail = rawToUiTicketDetail(
      {
        "@id": 406621,
        "@COMMON_NAME": 5254,
        ref_num: 5254,
        summary: "",
        description: "",
        priority: { "@id": 502, "@REL_ATTR": 3, "@COMMON_NAME": 3 },
      },
      "problem",
    );
    expect(detail.ref).toBe("5254");
    expect(detail.linked.changes).toEqual([]);
  });
});
