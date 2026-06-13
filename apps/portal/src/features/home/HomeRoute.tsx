import { useMemo } from "react";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { queryClient } from "../../lib/query-client";
import { useSession } from "../../shell/session-context";
import { deriveHomeStats, deriveRecentActivity, prefetchHome } from "./api";
import { AnnouncementsCard } from "./components/AnnouncementsCard";
import { CatalogTeaser } from "./components/CatalogTeaser";
import { HeroGreeting } from "./components/HeroGreeting";
import { HeroStats } from "./components/HeroStats";
import { OpenTicketsCard } from "./components/OpenTicketsCard";
import { QuickActions } from "./components/QuickActions";
import { RecentActivity } from "./components/RecentActivity";
import { useMyAllTickets, useMyTickets } from "./hooks";
import "./home.css";

/**
 * Lucia's landing page (`/`) — v1.1.4 multi-column dashboard per K.1 design
 * brief §10.1. Grid layout drives the column structure (one `grid-template-
 * areas` per breakpoint, see `home.css`). Six distinct widgets:
 *
 *   row 1   <HeroGreeting>                            (greeting + KB search + chips)
 *   row 2   <HeroStats>                               (3-up KPI tiles)
 *   row 3   <QuickActions>                            (3-up Tile grid)
 *   row 4   <OpenTicketsCard> | <AnnouncementsCard>   (split at lg+)
 *   row 5   <CatalogTeaser>                           (4 category tiles + "Všetko →")
 *   row 6   <RecentActivity>                          (synthesised timeline)
 *
 * I.0 perf rule preserved — the static shell renders unconditionally so the
 * H1 inside `<HeroGreeting>` paints at first render and remains the LCP
 * target. Data-dependent widgets render Skeleton rows while their queries
 * are pending; the chrome stays in place, no CLS.
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");

export function HomeRoute() {
  const { t } = useTranslation("portal");
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const enabled = session !== null;

  // `myTicketsQuery` (top 5) feeds the OpenTicketsCard; `myAllTicketsQuery`
  // (top 50) feeds the KPI stats + activity feed. Both are pre-warmed by
  // the bootstrap prefetch, so first paint on the happy path is synchronous.
  const ticketsQuery = useMyTickets(tenantId, enabled);
  const allTicketsQuery = useMyAllTickets(tenantId, enabled);

  const tickets = ticketsQuery.data ?? [];
  // `query.data` is a fresh reference when the cache is empty (the
  // `?? []` fallback creates a new array each render). Memoise it so the
  // downstream `deriveHomeStats` / `deriveRecentActivity` don't recompute on
  // every render before the query resolves.
  const allTickets = useMemo(() => allTicketsQuery.data ?? [], [allTicketsQuery.data]);

  const stats = useMemo(
    () => (allTicketsQuery.isPending ? null : deriveHomeStats(allTickets)),
    [allTickets, allTicketsQuery.isPending],
  );
  const activity = useMemo(() => deriveRecentActivity(allTickets), [allTickets]);

  return (
    <section className="sdm-home" data-testid="portal-home">
      <h1 className="sdm-visually-hidden">{t("appName")}</h1>
      {session ? (
        <span className="sdm-visually-hidden" data-testid="active-tenant">
          {session.tenantId}
        </span>
      ) : null}
      <div className="sdm-home-grid">
        <div className="sdm-home-area sdm-home-area-hero">
          <HeroGreeting session={session} />
        </div>
        <div className="sdm-home-area sdm-home-area-kpi">
          <HeroStats stats={stats} />
        </div>
        <div className="sdm-home-area sdm-home-area-actions">
          <QuickActions />
        </div>
        <div className="sdm-home-area sdm-home-area-tickets">
          <OpenTicketsCard
            tickets={tickets}
            pending={enabled && ticketsQuery.isPending}
            error={ticketsQuery.isError}
          />
        </div>
        <div className="sdm-home-area sdm-home-area-announcements">
          <AnnouncementsCard />
        </div>
        <div className="sdm-home-area sdm-home-area-catalog">
          <CatalogTeaser />
        </div>
        <div className="sdm-home-area sdm-home-area-activity">
          <RecentActivity
            events={activity}
            pending={enabled && allTicketsQuery.isPending}
            error={allTicketsQuery.isError}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Loader: kicks off the home dashboard prefetch but does NOT await it.
 * After I.0 the route renders a static shell (`<HeroGreeting>` +
 * `<QuickActions>` + `<CatalogTeaser>`) immediately, with skeletons in the
 * data-dependent sections — blocking paint on the network round-trip
 * dragged LCP past the 1.5 s mobile budget (render-delay was 84 % of LCP).
 *
 * The active tenant ID is read from the cached `/me` response so the loader
 * doesn't fire a second `/me` round-trip. Bootstrap also fires the home
 * prefetch directly, so the loader's call is usually a no-op deduped by
 * TanStack Query — kept here so client-side navigations to `/` still warm
 * the cache.
 */
interface MeQueryShape {
  readonly session?: { readonly tenantId?: string };
}

export function homeLoader(): null {
  const cached = queryClient.getQueryData<MeQueryShape>(["me"]);
  const tenantId = cached?.session?.tenantId;
  if (!tenantId) return null;
  void prefetchHome(queryClient, tenantId as never).catch(() => {
    // Component-level `isError` paths surface the user-facing message.
  });
  return null;
}

export default HomeRoute;
