import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { bootstrapI18n, I18nProvider } from "@sdm/i18n";
import {
  getScreenVisibilityForRoles,
  hasPermission,
  type Permission,
  type ScreenId,
  type UIRole,
} from "@sdm/domain";
import { NAV_GROUPS, visibleNavFor } from "./nav-model";
import type { FeatureFlags } from "../bootstrap/config";

// --- module mocks ------------------------------------------------------------
// The header/footer subcomponents pull in TanStack Query / hotkeys / command
// palette wiring that is irrelevant to the role-driven nav under test. Stub
// them so the test exercises only the nav-model projection.
vi.mock("./tenant-switcher", () => ({ TenantSwitcher: () => null }));
vi.mock("./language-switcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("./command-palette-mount", () => ({ openWorkspaceCommandPalette: () => {} }));

const featureState: { features: FeatureFlags } = {
  features: {
    kbEditor: false,
    cmdbVisualizer: false,
    bulkOperations: false,
    changeCalendar: false,
    reportingWidgets: false,
  },
};
vi.mock("../bootstrap/config", () => ({
  getConfig: () => ({ features: featureState.features }),
}));

const sessionState: { roles: readonly UIRole[] } = { roles: [] };
vi.mock("./session-context", () => ({
  useSession: () => ({
    session: { displayName: "Test User", roles: sessionState.roles },
    logout: () => Promise.resolve(),
  }),
}));

// Import AFTER the mocks are registered.
import { LeftRail } from "./left-rail";

// Group keys for every group in the model — used to force all groups open so
// collapsed (`defaultOpen:false`) groups still render their item lists.
const ALL_GROUP_KEYS = ["SERVICE_DESK", "CHANGE", "KNOWLEDGE", "CMDB", "ADMIN", "REPORTS"] as const;

function renderRail(roles: readonly UIRole[], features?: Partial<FeatureFlags>): void {
  localStorage.clear();
  for (const key of ALL_GROUP_KEYS) {
    localStorage.setItem(`sdm.workspace.rail.${key}`, "true");
  }
  sessionState.roles = roles;
  featureState.features = {
    kbEditor: false,
    cmdbVisualizer: false,
    bulkOperations: false,
    changeCalendar: false,
    reportingWidgets: false,
    ...features,
  };
  render(
    <I18nProvider>
      <MemoryRouter>
        <LeftRail />
      </MemoryRouter>
    </I18nProvider>,
  );
}

function visibleGroupSlugs(): string[] {
  return screen
    .getAllByTestId(/^workspace-rail-group-(?!help)/)
    .map((el) => el.getAttribute("data-testid")!.replace("workspace-rail-group-", ""));
}

function groupItems(slug: string): { slug: string; readonly: boolean }[] {
  const groupBtn = screen.getByTestId(`workspace-rail-group-${slug}`);
  const section = groupBtn.closest(".sdm-rail-group")!;
  return within(section as HTMLElement)
    .getAllByTestId(/^workspace-rail-item-(?!readonly)/)
    .map((li) => ({
      slug: li.getAttribute("data-testid")!.replace("workspace-rail-item-", ""),
      readonly: li.getAttribute("data-readonly") === "true",
    }));
}

/** Compact `slug` / `slug[ro]` rendering of a group's items, matching the
 *  task's expectation table. */
function itemSpec(slug: string): string[] {
  return groupItems(slug).map((i) => (i.readonly ? `${i.slug}[ro]` : i.slug));
}

beforeAll(async () => {
  await bootstrapI18n({ app: "workspace", initialLocale: "sk" });
});

describe("LeftRail — role-driven nav", () => {
  it("agent_l1", () => {
    renderRail(["agent_l1"]);
    expect(visibleGroupSlugs()).toEqual(["service-desk", "change", "knowledge", "cmdb"]);
    expect(itemSpec("service-desk")).toEqual([
      "myqueue",
      "triage",
      "in-progress",
      "on-hold",
      "resolved",
      "problems[ro]",
    ]);
    expect(itemSpec("change")).toEqual(["pending-approval[ro]", "scheduled[ro]", "calendar[ro]"]);
    expect(itemSpec("knowledge")).toEqual(["browse-kb"]);
    expect(itemSpec("cmdb")).toEqual(["cmdb[ro]"]);
    expect(screen.queryByTestId("workspace-rail-group-admin")).toBeNull();
    expect(screen.queryByTestId("workspace-rail-group-reports")).toBeNull();
  });

  it("agent_l2", () => {
    renderRail(["agent_l2"]);
    expect(visibleGroupSlugs()).toEqual(["service-desk", "change", "knowledge", "cmdb"]);
    expect(itemSpec("service-desk")).toEqual([
      "myqueue",
      "triage",
      "in-progress",
      "on-hold",
      "resolved",
      "problems",
    ]);
    expect(itemSpec("change")).toEqual(["pending-approval[ro]", "scheduled[ro]", "calendar[ro]"]);
    expect(itemSpec("knowledge")).toEqual(["browse-kb", "manage-kb[ro]", "kb-analytics[ro]"]);
    expect(itemSpec("cmdb")).toEqual(["cmdb[ro]"]);
    expect(screen.queryByTestId("workspace-rail-group-admin")).toBeNull();
  });

  it("change_manager", () => {
    renderRail(["change_manager"]);
    expect(visibleGroupSlugs()).toEqual(["service-desk", "change", "knowledge", "cmdb"]);
    expect(itemSpec("service-desk")).toEqual([
      "myqueue[ro]",
      "triage[ro]",
      "in-progress[ro]",
      "on-hold[ro]",
      "resolved[ro]",
      "problems[ro]",
    ]);
    expect(itemSpec("change")).toEqual(["pending-approval", "scheduled", "calendar", "cab"]);
    expect(itemSpec("knowledge")).toEqual(["browse-kb"]);
    expect(itemSpec("cmdb")).toEqual(["cmdb[ro]"]);
    expect(screen.queryByTestId("workspace-rail-group-admin")).toBeNull();
  });

  it("kb_editor", () => {
    renderRail(["kb_editor"]);
    expect(visibleGroupSlugs()).toEqual(["service-desk", "change", "knowledge"]);
    expect(itemSpec("service-desk")).toEqual([
      "myqueue[ro]",
      "triage[ro]",
      "in-progress[ro]",
      "on-hold[ro]",
      "resolved[ro]",
      "problems[ro]",
    ]);
    expect(itemSpec("change")).toEqual(["pending-approval[ro]", "scheduled[ro]"]);
    expect(itemSpec("knowledge")).toEqual(["browse-kb", "manage-kb", "kb-analytics"]);
    expect(screen.queryByTestId("workspace-rail-group-cmdb")).toBeNull();
    expect(screen.queryByTestId("workspace-rail-group-admin")).toBeNull();
    expect(screen.queryByTestId("workspace-rail-group-reports")).toBeNull();
  });

  it("cmdb_owner", () => {
    renderRail(["cmdb_owner"]);
    expect(visibleGroupSlugs()).toEqual(["service-desk", "change", "knowledge", "cmdb"]);
    expect(itemSpec("service-desk")).toEqual([
      "myqueue[ro]",
      "triage[ro]",
      "in-progress[ro]",
      "on-hold[ro]",
      "resolved[ro]",
      "problems[ro]",
    ]);
    expect(itemSpec("change")).toEqual(["pending-approval[ro]", "scheduled[ro]", "calendar[ro]"]);
    expect(itemSpec("knowledge")).toEqual(["browse-kb"]);
    expect(itemSpec("cmdb")).toEqual(["cmdb"]);
    expect(screen.queryByTestId("workspace-rail-group-admin")).toBeNull();
  });

  it("sp_admin (reportingWidgets off)", () => {
    renderRail(["sp_admin"]);
    expect(visibleGroupSlugs()).toEqual(["service-desk", "change", "knowledge", "cmdb", "admin"]);
    expect(itemSpec("service-desk")).toEqual([
      "myqueue",
      "triage",
      "in-progress",
      "on-hold",
      "resolved",
      "problems",
    ]);
    expect(itemSpec("change")).toEqual(["pending-approval", "scheduled", "calendar", "cab"]);
    expect(itemSpec("knowledge")).toEqual(["browse-kb", "manage-kb", "kb-analytics"]);
    expect(itemSpec("cmdb")).toEqual(["cmdb"]);
    expect(itemSpec("admin")).toEqual(["service-provider"]);
    expect(screen.queryByTestId("workspace-rail-group-reports")).toBeNull();
  });

  it("reportingWidgets=true unlocks the reports group", () => {
    renderRail(["sp_admin"], { reportingWidgets: true });
    expect(visibleGroupSlugs()).toEqual([
      "service-desk",
      "change",
      "knowledge",
      "cmdb",
      "admin",
      "reports",
    ]);
    expect(itemSpec("reports")).toEqual(["reports"]);
  });

  it("reportingWidgets=true shows reports[ro] for agent_l1", () => {
    renderRail(["agent_l1"], { reportingWidgets: true });
    expect(visibleGroupSlugs()).toContain("reports");
    expect(itemSpec("reports")).toEqual(["reports[ro]"]);
  });

  it("empty groups are hidden — admin only present for sp_admin", () => {
    for (const role of [
      "agent_l1",
      "agent_l2",
      "change_manager",
      "kb_editor",
      "cmdb_owner",
    ] as const) {
      renderRail([role]);
      expect(screen.queryByTestId("workspace-rail-group-admin")).toBeNull();
    }
    renderRail(["sp_admin"]);
    expect(screen.queryByTestId("workspace-rail-group-admin")).not.toBeNull();
  });
});

describe("INVARIANT — menu visibility pins to the RBAC matrix", () => {
  const ALL_ROLES: readonly UIRole[] = [
    "agent_l1",
    "agent_l2",
    "change_manager",
    "kb_editor",
    "cmdb_owner",
    "sp_admin",
  ];
  const features: FeatureFlags = {
    kbEditor: false,
    cmdbVisualizer: false,
    bulkOperations: false,
    changeCalendar: false,
    reportingWidgets: true,
  };

  function itemPasses(
    item: {
      requiredScreen?: ScreenId;
      requiredPermission?: Permission;
      requiredFeature?: keyof FeatureFlags;
    },
    role: UIRole,
  ): boolean {
    if (item.requiredFeature && !features[item.requiredFeature]) return false;
    if (item.requiredPermission && !hasPermission([role], item.requiredPermission)) return false;
    if (item.requiredScreen) {
      return getScreenVisibilityForRoles([role], item.requiredScreen) !== "hidden";
    }
    return true;
  }

  for (const role of ALL_ROLES) {
    for (const group of NAV_GROUPS) {
      it(`${role} / ${group.slug}: visibleNavFor ⇔ at least one passing gate`, () => {
        const lhs = visibleNavFor([role], features).some((g) => g.key === group.key);
        const rhs = group.items.some((item) => itemPasses(item, role));
        expect(lhs).toBe(rhs);
      });
    }
  }
});
