import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import type { HomeStats } from "../types";

/**
 * 3-up KPI strip on the home dashboard (K.1 §10.1 mockup row 2). Tiles read
 * "Otvorené", "Čakajúce na odpoveď", "Vybavené tento týždeň" — counts come
 * from `deriveHomeStats` (called once in `HomeRoute` so this component is
 * pure render). Each tile links to `/tickets` (filter routing is a future
 * v1.2 wire-up; the brief explicitly permits the unfiltered fallback).
 */

function InboxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

interface KpiTileProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: number | null;
  readonly href: string;
  readonly testId: string;
  readonly tone: "open" | "awaiting" | "resolved";
}

function KpiTile({ icon, label, value, href, testId, tone }: KpiTileProps) {
  return (
    <Link
      to={href}
      className="sdm-home-kpi-tile"
      data-component="home-kpi-tile"
      data-tone={tone}
      data-testid={testId}
    >
      <span className="sdm-home-kpi-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sdm-home-kpi-value">
        {value === null ? (
          <Skeleton variant="text" width={28} height={28} />
        ) : (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
        )}
      </span>
      <span className="sdm-home-kpi-label">{label}</span>
    </Link>
  );
}

export interface HeroStatsProps {
  /**
   * Pre-derived bucket counts. `null` while the underlying
   * `myAllTicketsQuery` is still pending so the tile can render a skeleton
   * for the value without shifting the row layout.
   */
  readonly stats: HomeStats | null;
}

export function HeroStats({ stats }: HeroStatsProps) {
  const { t } = useTranslation("portal");
  return (
    <section
      className="sdm-home-kpi-grid"
      data-testid="home-stats"
      aria-label={t("home.stats.ariaLabel")}
    >
      <KpiTile
        icon={<InboxIcon />}
        label={t("home.stats.open")}
        value={stats?.open ?? null}
        href="/tickets?filter=open"
        testId="home-stats-open"
        tone="open"
      />
      <KpiTile
        icon={<ClockIcon />}
        label={t("home.stats.awaiting")}
        value={stats?.awaiting ?? null}
        href="/tickets?filter=awaiting"
        testId="home-stats-awaiting"
        tone="awaiting"
      />
      <KpiTile
        icon={<CheckIcon />}
        label={t("home.stats.resolvedThisWeek")}
        value={stats?.resolvedThisWeek ?? null}
        href="/tickets?filter=resolved"
        testId="home-stats-resolved"
        tone="resolved"
      />
    </section>
  );
}
