import { describe, expect, it } from "vitest";
import type { UiTicketDetailActivity, UiTicketDetailAttachments } from "@sdm/api-types";
import { rawToUiTicketDetail } from "../../../src/aggregator/shapers/ui-ticket-detail";

const emptySupportedBranches: {
  activity: UiTicketDetailActivity;
  attachments: UiTicketDetailAttachments;
} = {
  activity: { _unsupported: false, items: [], hasMore: false },
  attachments: { _unsupported: false, items: [] },
};

describe("rawToUiTicketDetail", () => {
  it("incident: shape includes branch results; linked stays _unsupported per §24", () => {
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
      emptySupportedBranches,
    );
    expect(detail.ticketType).toBe("incident");
    expect(detail.ref).toBe("SD:01");
    // Linked stays unsupported — no BREL relation works on CA SDM 17.4 (§24).
    expect(detail.linked._unsupported).toBe(true);
    expect(detail.linked.problems).toEqual([]);
    // Activity + attachments thread through from caller; supported empty here.
    expect(detail.attachments._unsupported).toBe(false);
    expect(detail.activity._unsupported).toBe(false);
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
      emptySupportedBranches,
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
      emptySupportedBranches,
    );
    expect(detail.ref).toBe("5254");
    expect(detail.linked.changes).toEqual([]);
  });

  it("passes through caller-supplied activity items + attachments items verbatim", () => {
    const detail = rawToUiTicketDetail(
      { "@id": 1, ref_num: "X", summary: "x", description: "" },
      "incident",
      {
        activity: {
          _unsupported: false,
          hasMore: true,
          items: [
            {
              id: "a1",
              kind: "public",
              text: "hi",
              createdAt: null,
              author: null,
            },
          ],
        },
        attachments: {
          _unsupported: false,
          items: [
            {
              id: "att1",
              name: "f.pdf",
              mime: "application/pdf",
              sizeBytes: 100,
              uploadedAt: null,
            },
          ],
        },
      },
    );
    expect(detail.activity.items).toHaveLength(1);
    expect(detail.activity.items[0]?.id).toBe("a1");
    expect(detail.attachments.items[0]?.name).toBe("f.pdf");
  });

  it("propagates _unsupported:true when a branch fell back to the failure shape", () => {
    const detail = rawToUiTicketDetail(
      { "@id": 1, ref_num: "X", summary: "x", description: "" },
      "incident",
      {
        activity: { _unsupported: true, items: [], hasMore: false },
        attachments: { _unsupported: false, items: [] },
      },
    );
    expect(detail.activity._unsupported).toBe(true);
    expect(detail.attachments._unsupported).toBe(false);
  });
});
