import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { queryClient } from "../../lib/query-client";
import { useSession } from "../../shell/session-context";
import { prefetchHome } from "./api";
import { ActionCards } from "./components/ActionCards";
import { HeroGreeting } from "./components/HeroGreeting";
import { KbSuggestions } from "./components/KbSuggestions";
import { MyRecentTickets } from "./components/MyRecentTickets";
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
 * Data is pre-fetched in `homeLoader` so the first render is synchronous
 * against the React-Query cache; the hooks below subscribe so a background
 * refetch (60 s for tickets, 5 min for KB) updates the UI without flicker.
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

  if (!session) return null;

  const tickets = ticketsQuery.data ?? [];
  const suggestions = kbQuery.data ?? [];

  return (
    <section className="sdm-home" data-testid="portal-home">
      <h1 className="sdm-visually-hidden">SDM Portal</h1>
      <span className="sdm-visually-hidden" data-testid="active-tenant">
        {session.tenantId}
      </span>
      <HeroGreeting session={session} />
      <ActionCards />
      {ticketsQuery.isError ? (
        <p className="sdm-home-error" role="alert" data-testid="home-my-tickets-error">
          {t("home.myTickets.error")}
        </p>
      ) : (
        <MyRecentTickets tickets={tickets} />
      )}
      {!kbQuery.isError ? <KbSuggestions suggestions={suggestions} /> : null}
    </section>
  );
}

/**
 * Loader: parallel `ensureQueryData` so the first paint after navigation has
 * both panels populated (no waterfall). Failures swallowed by TanStack Query
 * surface in the component layer (each hook has its own error path) — the
 * loader itself stays resolve-only so a 500 on `/api/kb` doesn't blank the
 * whole page.
 *
 * The active tenant ID is read from the cached `/me` response so the loader
 * doesn't fire a second `/me` round-trip. If `/me` hasn't landed yet (the
 * loader runs concurrently with the bootstrap session fetch on a cold open),
 * we skip prefetch and let the components fall back to lazy fetch on mount.
 */
interface MeQueryShape {
  readonly session?: { readonly tenantId?: string };
}

export async function homeLoader(): Promise<null> {
  const cached = queryClient.getQueryData<MeQueryShape>(["me"]);
  const tenantId = cached?.session?.tenantId;
  if (!tenantId) return null;
  await prefetchHome(queryClient, tenantId as never);
  return null;
}

export default HomeRoute;
