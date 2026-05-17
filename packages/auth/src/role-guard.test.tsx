import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Permission, UIRole } from "@sdm/domain";
import { Can, RouteGuard, ScreenGuard } from "./role-guard";

const ALL_ROLES: readonly UIRole[] = [
  "requester",
  "requester_external",
  "agent_l1",
  "agent_l2",
  "change_manager",
  "kb_editor",
  "cmdb_owner",
  "sp_admin",
];

describe("<Can>", () => {
  it("renders children when the active role grants the permission", () => {
    const html = renderToStaticMarkup(
      <Can roles={["agent_l1"]} permission="incident.read.queue">
        <span>queue</span>
      </Can>,
    );
    expect(html).toBe("<span>queue</span>");
  });

  it("renders fallback when the role lacks the permission", () => {
    const html = renderToStaticMarkup(
      <Can roles={["requester"]} permission="incident.read.queue" fallback={<span>nope</span>}>
        <span>queue</span>
      </Can>,
    );
    expect(html).toBe("<span>nope</span>");
  });

  it("renders nothing when denied and no fallback provided", () => {
    const html = renderToStaticMarkup(
      <Can roles={["requester"]} permission="cab.approve">
        <span>approve</span>
      </Can>,
    );
    expect(html).toBe("");
  });

  it("aggregates permissions across a multi-role session", () => {
    const html = renderToStaticMarkup(
      <Can roles={["agent_l1", "change_manager"]} permission="cab.approve">
        <span>approve</span>
      </Can>,
    );
    expect(html).toBe("<span>approve</span>");
  });
});

describe("<Can> — role × key-permission coverage (rbac.md §6)", () => {
  const cases: ReadonlyArray<[Permission, Record<UIRole, boolean>]> = [
    [
      "app.portal.access",
      {
        requester: true,
        requester_external: true,
        agent_l1: false,
        agent_l2: false,
        change_manager: false,
        kb_editor: false,
        cmdb_owner: false,
        sp_admin: false,
      },
    ],
    [
      "app.workspace.access",
      {
        requester: false,
        requester_external: false,
        agent_l1: true,
        agent_l2: true,
        change_manager: true,
        kb_editor: true,
        cmdb_owner: true,
        sp_admin: true,
      },
    ],
    [
      "incident.read.queue",
      {
        requester: false,
        requester_external: false,
        agent_l1: true,
        agent_l2: true,
        change_manager: false,
        kb_editor: false,
        cmdb_owner: false,
        sp_admin: true,
      },
    ],
    [
      "incident.escalate",
      {
        requester: false,
        requester_external: false,
        agent_l1: true,
        agent_l2: true,
        change_manager: false,
        kb_editor: false,
        cmdb_owner: false,
        sp_admin: true,
      },
    ],
    [
      "incident.delete",
      {
        requester: false,
        requester_external: false,
        agent_l1: false,
        agent_l2: false,
        change_manager: false,
        kb_editor: false,
        cmdb_owner: false,
        sp_admin: true,
      },
    ],
    [
      "problem.update.rca",
      {
        requester: false,
        requester_external: false,
        agent_l1: false,
        agent_l2: true,
        change_manager: false,
        kb_editor: false,
        cmdb_owner: false,
        sp_admin: true,
      },
    ],
    [
      "cab.approve",
      {
        requester: false,
        requester_external: false,
        agent_l1: false,
        agent_l2: false,
        change_manager: true,
        kb_editor: false,
        cmdb_owner: false,
        sp_admin: true,
      },
    ],
    [
      "kb.approve",
      {
        requester: false,
        requester_external: false,
        agent_l1: false,
        agent_l2: false,
        change_manager: false,
        kb_editor: true,
        cmdb_owner: false,
        sp_admin: true,
      },
    ],
    [
      "ci.update",
      {
        requester: false,
        requester_external: false,
        agent_l1: false,
        agent_l2: false,
        change_manager: false,
        kb_editor: false,
        cmdb_owner: true,
        sp_admin: true,
      },
    ],
    [
      "tenant.admin",
      {
        requester: false,
        requester_external: false,
        agent_l1: false,
        agent_l2: false,
        change_manager: false,
        kb_editor: false,
        cmdb_owner: false,
        sp_admin: true,
      },
    ],
  ];

  for (const [permission, expected] of cases) {
    describe(permission, () => {
      for (const role of ALL_ROLES) {
        it(`${role} → ${expected[role] ? "renders" : "hides"}`, () => {
          const html = renderToStaticMarkup(
            <Can roles={[role]} permission={permission} fallback={<i>denied</i>}>
              <span>granted</span>
            </Can>,
          );
          expect(html).toBe(expected[role] ? "<span>granted</span>" : "<i>denied</i>");
        });
      }
    });
  }
});

describe("<RouteGuard>", () => {
  it("invokes onDenied when permission missing", () => {
    const html = renderToStaticMarkup(
      <RouteGuard
        roles={["requester"]}
        require="incident.read.queue"
        onDenied={() => <span>403</span>}
      >
        <span>secret</span>
      </RouteGuard>,
    );
    expect(html).toBe("<span>403</span>");
  });

  it("renders children when permission granted", () => {
    const html = renderToStaticMarkup(
      <RouteGuard
        roles={["change_manager"]}
        require="cab.approve"
        onDenied={() => <span>403</span>}
      >
        <span>approve UI</span>
      </RouteGuard>,
    );
    expect(html).toBe("<span>approve UI</span>");
  });
});

describe("<ScreenGuard>", () => {
  it("denies hidden screens", () => {
    const html = renderToStaticMarkup(
      <ScreenGuard
        roles={["requester"]}
        screen="WORKSPACE_INCIDENT_QUEUE"
        onDenied={() => <span>403</span>}
      >
        <span>queue</span>
      </ScreenGuard>,
    );
    expect(html).toBe("<span>403</span>");
  });

  it("allows readonly screens in default view mode", () => {
    const html = renderToStaticMarkup(
      <ScreenGuard
        roles={["change_manager"]}
        screen="WORKSPACE_INCIDENT_QUEUE"
        onDenied={() => <span>403</span>}
      >
        <span>queue</span>
      </ScreenGuard>,
    );
    expect(html).toBe("<span>queue</span>");
  });

  it("blocks readonly screens in edit mode", () => {
    const html = renderToStaticMarkup(
      <ScreenGuard
        roles={["change_manager"]}
        screen="WORKSPACE_INCIDENT_QUEUE"
        mode="edit"
        onDenied={() => <span>readonly</span>}
      >
        <span>edit</span>
      </ScreenGuard>,
    );
    expect(html).toBe("<span>readonly</span>");
  });

  it("aggregates multi-role visibility (highest wins)", () => {
    const html = renderToStaticMarkup(
      <ScreenGuard
        roles={["agent_l1", "change_manager"]}
        screen="WORKSPACE_CAB_QUEUE"
        onDenied={() => <span>403</span>}
      >
        <span>cab</span>
      </ScreenGuard>,
    );
    expect(html).toBe("<span>cab</span>");
  });
});
