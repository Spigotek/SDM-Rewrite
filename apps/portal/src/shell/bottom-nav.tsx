import type { MouseEvent, ReactNode, SVGProps } from "react";
import { useTranslation } from "@sdm/i18n";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * K.3 mobile bottom nav — sticky tab bar shown only below the `md` breakpoint
 * (gated in `styles.css`). Mirrors the 4 desktop top-nav destinations as
 * icon-only tabs with sr-only labels; the active tab gets a filled icon
 * variant and a 2-px top bar in brand-500 (per K.1 brief §6.1 NavLink horizontal).
 */

type IconVariant = "outline" | "filled";

interface SvgChildrenFn {
  (variant: IconVariant): ReactNode;
}

function TabIcon({ children }: { children: ReactNode }) {
  const props: SVGProps<SVGSVGElement> = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
  };
  return <svg {...props}>{children}</svg>;
}

function FilledTabIcon({ children }: { children: ReactNode }) {
  const props: SVGProps<SVGSVGElement> = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
  };
  return <svg {...props}>{children}</svg>;
}

const HomeIcon: SvgChildrenFn = (variant) => {
  const path = <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />;
  return variant === "filled" ? <FilledTabIcon>{path}</FilledTabIcon> : <TabIcon>{path}</TabIcon>;
};

const InboxIcon: SvgChildrenFn = (variant) => {
  const children = (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11" />
    </>
  );
  return variant === "filled" ? (
    <FilledTabIcon>{children}</FilledTabIcon>
  ) : (
    <TabIcon>{children}</TabIcon>
  );
};

const LayoutGridIcon: SvgChildrenFn = (variant) => {
  const children = (
    <>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </>
  );
  return variant === "filled" ? (
    <FilledTabIcon>{children}</FilledTabIcon>
  ) : (
    <TabIcon>{children}</TabIcon>
  );
};

const BookOpenIcon: SvgChildrenFn = (variant) => {
  const children = (
    <>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </>
  );
  return variant === "filled" ? (
    <FilledTabIcon>{children}</FilledTabIcon>
  ) : (
    <TabIcon>{children}</TabIcon>
  );
};

interface Tab {
  readonly slug: string;
  readonly href: string;
  readonly labelKey: string;
  readonly icon: SvgChildrenFn;
}

const TABS: readonly Tab[] = [
  { slug: "home", href: "/", labelKey: "nav.home", icon: HomeIcon },
  { slug: "tickets", href: "/tickets", labelKey: "nav.myTickets", icon: InboxIcon },
  { slug: "catalog", href: "/catalog", labelKey: "nav.catalog", icon: LayoutGridIcon },
  { slug: "kb", href: "/kb", labelKey: "nav.knowledge", icon: BookOpenIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const { t } = useTranslation("portal");
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };

  return (
    <nav
      className="sdm-portal-bottom-nav"
      data-testid="portal-bottom-nav"
      aria-label={t("nav.bottomNav.aria")}
    >
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <a
            key={tab.slug}
            href={tab.href}
            className={`sdm-portal-bottom-nav-tab${active ? " is-active" : ""}`}
            data-testid={`portal-bottom-nav-tab-${tab.slug}`}
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
            onClick={(event) => handleClick(event, tab.href)}
          >
            <span className="sdm-portal-bottom-nav-icon" aria-hidden="true">
              {tab.icon(active ? "filled" : "outline")}
            </span>
            <span className="sdm-sr-only">{t(tab.labelKey)}</span>
          </a>
        );
      })}
    </nav>
  );
}
