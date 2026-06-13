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
  // Home — render nothing.
  if (pathname === "/" || pathname === "") return [];

  const segments = pathname.split("/").filter(Boolean);
  const home: BreadcrumbItem = { label: t("nav.home"), href: "/" };
  const [root, second, third] = segments;

  switch (root) {
    case "tickets": {
      if (!second) return [home, { label: t("nav.myTickets") }];
      return [home, { label: t("nav.myTickets"), href: "/tickets" }, { label: second }];
    }
    case "catalog": {
      if (!second) return [home, { label: t("nav.catalog") }];
      return [home, { label: t("nav.catalog"), href: "/catalog" }, { label: second }];
    }
    case "kb": {
      if (!second) return [home, { label: t("nav.knowledge") }];
      if (second === "article" && third) {
        return [home, { label: t("nav.knowledge"), href: "/kb" }, { label: third }];
      }
      return [home, { label: t("nav.knowledge"), href: "/kb" }, { label: second }];
    }
    case "new-incident":
      return [home, { label: t("nav.newIncident") }];
    default:
      // Unknown route — render only Home + the raw slug. Better than a blank
      // trail because at least the user can navigate back home.
      return [home, { label: root ?? "" }];
  }
}
