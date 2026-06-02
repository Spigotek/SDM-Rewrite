import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { queryClient } from "../../lib/query-client";
import { useSession } from "../../shell/session-context";
import { prefetchHome } from "./api";
import { ActionCards } from "./components/ActionCards";
import { HeroGreeting } from "./components/HeroGreeting";
import { KbSuggestions } from "./components/KbSuggestions";
import { MyRecentTickets } from "./components/MyRecentTickets";
import { TicketRowSkeleton, KbCardSkeleton } from "./components/Skeletons";
import { useKbSuggestions, useMyTickets } from "./hooks";
import "./home.css";

/**
 * Lucia's landing page (`/`). Composition (top → bottom):
 *
 *   ┌─ <HeroGreeting>     "Ahoj, Lucia 👋 — Ako ti môžem pomôcť?"
 *   ├─ <ActionCards>      [Nahlásiť problém] [Požiadať o niečo]
 *   ├─ <MyRecentTickets>  top 5 incidents kde "customer=me"
 *   └─ <KbSuggestions>    top 3 KB articles (hidden when empty)
 *
 * I.0 perf fix: the structural shell renders unconditionally — `<HeroGreeting>`
 * + `<ActionCards>` are session-independent, so the "Nahlásiť problém" CTA
 * (the natural LCP target per `performance.md §2 portal /`) paints at the
 * first render. The data-dependent sections render skeletons while the
 * underlying queries are pending so LCP is bound by render time, not by the
 * post-render fetch round-trip.
 *
 * The previous `if (!session) return null;` early-return moved LCP to the
 * `<p class="sdm-home-empty">` element that paints AFTER `/me` →
 * `/api/incidents` → `/api/kb` resolves, which dragged LCP past the 1.5 s
 * mobile budget.
 */
// Placeholder tenant ID used for the React-Query key when the session is not
// yet ready. The route is reachable only through `<AppShell>` which gates on
// `status === "ready"`, so this fallback is dead code in production — it
// exists purely to keep the hook call order stable across renders (rules of
// hooks).
const TENANT_PLACEHOLDER = toTenantId("__pending__");

export function HomeRoute() {
  const { t } = useTranslation("portal");
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const ticketsQuery = useMyTickets(tenantId, session !== null);
  const kbQuery = useKbSuggestions(tenantId, session !== null);

  const tickets = ticketsQuery.data ?? [];
  const suggestions = kbQuery.data ?? [];
  const ticketsPending = session !== null && ticketsQuery.isPending;
  const kbPending = session !== null && kbQuery.isPending;

  return (
    <section className="sdm-home" data-testid="portal-home">
      <h1 className="sdm-visually-hidden">SDM Portal</h1>
      {session ? (
        <span className="sdm-visually-hidden" data-testid="active-tenant">
          {session.tenantId}
        </span>
      ) : null}
      <HeroGreeting session={session} />
      <ActionCards />
      {ticketsQuery.isError ? (
        <p className="sdm-home-error" role="alert" data-testid="home-my-tickets-error">
          {t("home.myTickets.error")}
        </p>
      ) : ticketsPending ? (
        <section className="sdm-home-section" data-testid="home-my-tickets-loading">
          <h2 className="sdm-home-section-title">{t("home.myTickets.title")}</h2>
          <ul className="sdm-home-ticket-list" aria-busy="true">
            <TicketRowSkeleton />
            <TicketRowSkeleton />
            <TicketRowSkeleton />
          </ul>
        </section>
      ) : (
        <MyRecentTickets tickets={tickets} />
      )}
      {kbQuery.isError ? null : kbPending ? (
        <section className="sdm-home-section" data-testid="home-kb-loading">
          <h2 className="sdm-home-section-title">{t("home.kb.title")}</h2>
          <ul className="sdm-home-kb-list" aria-busy="true">
            <KbCardSkeleton />
            <KbCardSkeleton />
            <KbCardSkeleton />
          </ul>
        </section>
      ) : (
        <KbSuggestions suggestions={suggestions} />
      )}
    </section>
  );
}

/**
 * Loader: kicks off the home dashboard prefetch but does NOT await it. After
 * I.0 the route renders a static shell (`<HeroGreeting>` + `<ActionCards>`)
 * immediately, with skeletons in the data-dependent sections — blocking
 * paint on the network round-trip dragged LCP past the 1.5 s mobile budget
 * (render-delay was 84% of LCP). The hooks below subscribe to the cache and
 * swap the skeletons for real content as soon as the prefetch resolves.
 *
 * The active tenant ID is read from the cached `/me` response so the loader
 * doesn't fire a second `/me` round-trip. After I.0 the cache is primed in
 * `main.tsx` once `loadSession()` resolves, so the loader hits warm on the
 * cold open path too (not just on `useActiveTenant`'s post-switch path).
 * Bootstrap also fires the home prefetch directly, so the loader's call is
 * usually a no-op deduped by TanStack Query — kept here so client-side
 * navigations to `/` still warm the cache.
 */
interface MeQueryShape {
  readonly session?: { readonly tenantId?: string };
}

export function homeLoader(): null {
  const cached = queryClient.getQueryData<MeQueryShape>(["me"]);
  const tenantId = cached?.session?.tenantId;
  if (!tenantId) return null;
  // Fire-and-forget — the component layer renders skeletons until the cache
  // resolves. A loader-level await would re-introduce the render-delay
  // waterfall the I.0 perf fix targets.
  void prefetchHome(queryClient, tenantId as never).catch(() => {
    // Component-level `isError` paths surface the user-facing message.
  });
  return null;
}

export default HomeRoute;
