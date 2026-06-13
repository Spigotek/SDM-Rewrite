import type { MouseEvent, ReactNode, SVGProps } from "react";
import { NavLink } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { useLocation, useNavigate } from "react-router-dom";

// Inline SVG icons — see the same rationale in `top-bar.tsx`: `lucide-react`
// is bundled by `@sdm/design-system` but not a direct dep of `@sdm/portal`.
function NavIcon({ children }: { children: ReactNode }) {
  const props: SVGProps<SVGSVGElement> = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
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
  <NavIcon>
    <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
  </NavIcon>
);
const InboxIcon = (
  <NavIcon>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11" />
  </NavIcon>
);
const LayoutGridIcon = (
  <NavIcon>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </NavIcon>
);
const BookOpenIcon = (
  <NavIcon>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </NavIcon>
);

interface NavDestination {
  readonly href: string;
  readonly labelKey: string;
  readonly icon: ReactNode;
}

const DESTINATIONS: readonly NavDestination[] = [
  { href: "/", labelKey: "nav.home", icon: HomeIcon },
  { href: "/tickets", labelKey: "nav.myTickets", icon: InboxIcon },
  { href: "/catalog", labelKey: "nav.catalog", icon: LayoutGridIcon },
  { href: "/kb", labelKey: "nav.knowledge", icon: BookOpenIcon },
];

/**
 * Prefix-match a route as "active". For `/` we require an exact match so the
 * Home tab does not stay highlighted on every sub-route; everything else is
 * activated when the current pathname equals the destination or sits below it
 * (e.g. `/tickets/407804` keeps the Tickets tab lit).
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavRowLinkProps {
  destination: NavDestination;
  active: boolean;
  label: string;
}

function NavRowLink({ destination, active, label }: NavRowLinkProps) {
  const navigate = useNavigate();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Honour modifier-key / middle-click open-in-new-tab affordances.
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
    navigate(destination.href);
  };

  return (
    <NavLink
      href={destination.href}
      label={label}
      icon={destination.icon}
      variant="horizontal"
      active={active}
      onClick={handleClick}
    />
  );
}

export function NavRow() {
  const { t } = useTranslation("portal");
  const { pathname } = useLocation();

  return (
    <nav className="sdm-nav-row" data-testid="nav-row" aria-label={t("nav.primary")}>
      {DESTINATIONS.map((destination) => (
        <NavRowLink
          key={destination.href}
          destination={destination}
          active={isActive(pathname, destination.href)}
          label={t(destination.labelKey)}
        />
      ))}
    </nav>
  );
}
