import type { MouseEvent, ReactNode } from "react";
import { NavLink } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { AlertTriangle, BookOpen, Box, GitBranch, Inbox } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

interface NavDestination {
  readonly href: string;
  readonly labelKey: string;
  readonly icon: ReactNode;
}

const DESTINATIONS: readonly NavDestination[] = [
  { href: "/queue", labelKey: "nav.queue", icon: <Inbox size={16} aria-hidden="true" /> },
  { href: "/changes", labelKey: "nav.changes", icon: <GitBranch size={16} aria-hidden="true" /> },
  {
    href: "/problems",
    labelKey: "nav.problems",
    icon: <AlertTriangle size={16} aria-hidden="true" />,
  },
  { href: "/cmdb", labelKey: "nav.cmdb", icon: <Box size={16} aria-hidden="true" /> },
  { href: "/kb", labelKey: "nav.kb", icon: <BookOpen size={16} aria-hidden="true" /> },
];

/**
 * Prefix-match a route as "active". A nav entry highlights when the current
 * pathname is exactly its `href` or sits below it (e.g. `/changes/calendar`
 * keeps `Zmeny` lit, `/kb/article/123` keeps `Znalosti` lit). `/tickets/:id`
 * is owned by the queue destination — agents reach individual tickets from
 * the queue, so keeping `Fronta` active there mirrors the mental model.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/queue") {
    return (
      pathname === "/queue" ||
      pathname.startsWith("/queue/") ||
      pathname === "/tickets" ||
      pathname.startsWith("/tickets/")
    );
  }
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
  const { t } = useTranslation();
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
