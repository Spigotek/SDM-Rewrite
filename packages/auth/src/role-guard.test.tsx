import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RoleCode } from "@sdm/domain";
import { Can, RouteGuard } from "./role-guard";

describe("<Can>", () => {
  const adminRoles: readonly RoleCode[] = ["ADMINISTRATOR"];
  const viewerRoles: readonly RoleCode[] = ["CONFIG_VIEWER"];

  it("renders children when permission is granted", () => {
    const html = renderToStaticMarkup(
      <Can roles={adminRoles} permission="INCIDENT_MODIFY">
        <span>granted</span>
      </Can>,
    );
    expect(html).toBe("<span>granted</span>");
  });

  it("renders fallback when permission is denied", () => {
    const html = renderToStaticMarkup(
      <Can roles={viewerRoles} permission="INCIDENT_MODIFY" fallback={<span>nope</span>}>
        <span>granted</span>
      </Can>,
    );
    expect(html).toBe("<span>nope</span>");
  });

  it("renders nothing when denied and no fallback provided", () => {
    const html = renderToStaticMarkup(
      <Can roles={viewerRoles} permission="INCIDENT_MODIFY">
        <span>x</span>
      </Can>,
    );
    expect(html).toBe("");
  });
});

describe("<RouteGuard>", () => {
  it("invokes onDenied when permission missing", () => {
    const html = renderToStaticMarkup(
      <RouteGuard
        roles={["CONFIG_VIEWER"]}
        require="INCIDENT_MODIFY"
        onDenied={() => <span>403</span>}
      >
        <span>secret</span>
      </RouteGuard>,
    );
    expect(html).toBe("<span>403</span>");
  });
});
