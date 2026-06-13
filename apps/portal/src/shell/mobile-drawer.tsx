import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent, ReactNode, SVGProps } from "react";
import { NavLink, Wordmark } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * K.3 mobile drawer — slide-in left rail with the same 4 primary destinations
 * the desktop horizontal nav exposes. Visibility is gated entirely via CSS on
 * `body[data-portal-drawer-open]` so the markup stays in the DOM for snappy
 * open/close transitions; the component itself owns focus management,
 * Escape-to-close, and outside-click dismissal.
 */

const DRAWER_BODY_ATTR = "data-portal-drawer-open";

function setDrawerOpen(open: boolean): void {
  if (typeof document === "undefined") return;
  if (open) {
    document.body.setAttribute(DRAWER_BODY_ATTR, "true");
  } else {
    document.body.removeAttribute(DRAWER_BODY_ATTR);
  }
}

function isDrawerOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.hasAttribute(DRAWER_BODY_ATTR);
}

// Inline SVGs match the icon set in `top-bar.tsx` / `nav-row.tsx` so the
// portal does not need a direct `lucide-react` dep.
function DrawerIcon({ children }: { children: ReactNode }) {
  const props: SVGProps<SVGSVGElement> = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 18,
    height: 18,
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

const HomeIcon = (
  <DrawerIcon>
    <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
  </DrawerIcon>
);
const InboxIcon = (
  <DrawerIcon>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11" />
  </DrawerIcon>
);
const LayoutGridIcon = (
  <DrawerIcon>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </DrawerIcon>
);
const BookOpenIcon = (
  <DrawerIcon>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </DrawerIcon>
);

interface Destination {
  readonly href: string;
  readonly labelKey: string;
  readonly icon: ReactNode;
}

const DESTINATIONS: readonly Destination[] = [
  { href: "/", labelKey: "nav.home", icon: HomeIcon },
  { href: "/tickets", labelKey: "nav.myTickets", icon: InboxIcon },
  { href: "/catalog", labelKey: "nav.catalog", icon: LayoutGridIcon },
  { href: "/kb", labelKey: "nav.knowledge", icon: BookOpenIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** Public helper so siblings (TopBar hamburger) can open the drawer. */
export function openPortalDrawer(): void {
  setDrawerOpen(true);
}

/** Public helper used internally + by tests. */
export function closePortalDrawer(): void {
  setDrawerOpen(false);
}

export function MobileDrawer() {
  const { t } = useTranslation("portal");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const firstFocusRef = useRef<HTMLButtonElement | null>(null);

  // Esc to close + focus the first interactive when the drawer opens, return
  // focus to the hamburger when it closes. We observe the body attribute via
  // MutationObserver so a click on the hamburger (which sets the attribute)
  // can drive both behaviours through a single source of truth.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isDrawerOpen()) {
        event.preventDefault();
        closePortalDrawer();
      }
    };
    document.addEventListener("keydown", handleKey);

    let lastOpen = isDrawerOpen();
    const observer = new MutationObserver(() => {
      const now = isDrawerOpen();
      if (now === lastOpen) return;
      lastOpen = now;
      if (now) {
        // Focus the first focusable element inside the drawer on open.
        // requestAnimationFrame defers past the transform transition so the
        // browser does not skip the animation when focus shifts.
        requestAnimationFrame(() => firstFocusRef.current?.focus());
      } else {
        const hamburger = document.querySelector<HTMLButtonElement>(
          '[data-testid="portal-hamburger"]',
        );
        hamburger?.focus();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: [DRAWER_BODY_ATTR] });

    return () => {
      document.removeEventListener("keydown", handleKey);
      observer.disconnect();
    };
  }, []);

  // Outside-click closes the drawer. Bound to the backdrop element rather than
  // a global listener so the hamburger button itself can still toggle without
  // a race against this handler.
  const handleBackdropClick = useCallback(() => {
    closePortalDrawer();
  }, []);

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
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
    closePortalDrawer();
    navigate(href);
  };

  return (
    <>
      <button
        type="button"
        className="sdm-mobile-drawer-backdrop"
        aria-hidden="true"
        tabIndex={-1}
        onClick={handleBackdropClick}
      />
      <aside
        ref={drawerRef}
        className="sdm-mobile-drawer"
        data-testid="portal-mobile-drawer"
        aria-label={t("nav.mobile.drawerAria")}
      >
        <div className="sdm-mobile-drawer-header">
          <span className="sdm-mobile-drawer-brand">
            <Wordmark size="md" />
          </span>
          <button
            ref={firstFocusRef}
            type="button"
            className="sdm-mobile-drawer-close"
            data-testid="portal-mobile-drawer-close"
            onClick={closePortalDrawer}
            aria-label={t("nav.mobile.close")}
            title={t("nav.mobile.close")}
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="sdm-mobile-drawer-nav" aria-label={t("nav.primary")}>
          {DESTINATIONS.map((destination) => (
            <NavLink
              key={destination.href}
              href={destination.href}
              label={t(destination.labelKey)}
              icon={destination.icon}
              variant="vertical"
              active={isActive(pathname, destination.href)}
              onClick={(event) => handleLinkClick(event, destination.href)}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
