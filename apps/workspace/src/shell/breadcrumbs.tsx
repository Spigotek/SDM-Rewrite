import { useMemo } from "react";
import { Breadcrumbs as DSBreadcrumbs } from "@sdm/design-system";
import type { BreadcrumbItem } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { useLocation } from "react-router-dom";

/**
 * Derives a breadcrumb trail from `pathname`. We intentionally avoid
 * `useMatches()` from the data router here: matches expose route ids only
 * after each lazy chunk has resolved, which means the trail would flicker
 * empty on first paint of a sub-route. Reading the pathname is synchronous
 * and gives us a stable label even before the page bundle lands.
 */
export function Breadcrumbs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const items = useMemo<BreadcrumbItem[]>(() => buildTrail(pathname, t), [pathname, t]);

  if (items.length === 0) return null;

  return (
    <div className="sdm-breadcrumbs-row">
      <DSBreadcrumbs items={items} data-testid="breadcrumbs" />
    </div>
  );
}

type Translate = (key: string, defaultValue?: string) => string;

function buildTrail(pathname: string, t: Translate): BreadcrumbItem[] {
  // Workspace root redirects to /queue, so the empty pathname never lingers
  // long enough to render. Bail out defensively anyway.
  if (pathname === "/" || pathname === "") return [];

  const segments = pathname.split("/").filter(Boolean);
  const workspace: BreadcrumbItem = { label: t("nav.workspace"), href: "/queue" };
  const [root, second, third] = segments;

  switch (root) {
    case "queue":
      return [workspace, { label: t("nav.queue") }];
    case "tickets": {
      // Ticket detail rolls up into the queue trail — the agent's mental
      // model is "I picked this ticket out of the queue".
      if (!second) return [workspace, { label: t("nav.queue") }];
      return [workspace, { label: t("nav.queue"), href: "/queue" }, { label: second }];
    }
    case "changes": {
      if (!second) return [workspace, { label: t("nav.changes") }];
      if (second === "calendar") {
        return [
          workspace,
          { label: t("nav.changes"), href: "/changes" },
          { label: t("nav.calendar") },
        ];
      }
      return [workspace, { label: t("nav.changes"), href: "/changes" }, { label: second }];
    }
    case "problems": {
      if (!second) return [workspace, { label: t("nav.problems") }];
      return [workspace, { label: t("nav.problems"), href: "/problems" }, { label: second }];
    }
    case "cmdb": {
      if (!second) return [workspace, { label: t("nav.cmdb") }];
      if (second === "ci" && third) {
        return [workspace, { label: t("nav.cmdb"), href: "/cmdb" }, { label: third }];
      }
      return [workspace, { label: t("nav.cmdb"), href: "/cmdb" }, { label: second }];
    }
    case "kb": {
      if (!second) return [workspace, { label: t("nav.kb") }];
      if (second === "article" && third) {
        return [workspace, { label: t("nav.kb"), href: "/kb" }, { label: third }];
      }
      if (second === "editor") {
        return [workspace, { label: t("nav.kb"), href: "/kb" }, { label: t("nav.editor") }];
      }
      if (second === "analytics") {
        return [workspace, { label: t("nav.kb"), href: "/kb" }, { label: t("nav.analytics") }];
      }
      return [workspace, { label: t("nav.kb"), href: "/kb" }, { label: second }];
    }
    case "sp": {
      if (second === "cockpit") {
        return [workspace, { label: t("nav.spCockpit") }];
      }
      return [workspace, { label: second ?? "" }];
    }
    default:
      // Unknown route — render only Workspace + the raw slug. Better than a
      // blank trail because at least the user can navigate back to the queue.
      return [workspace, { label: root ?? "" }];
  }
}
