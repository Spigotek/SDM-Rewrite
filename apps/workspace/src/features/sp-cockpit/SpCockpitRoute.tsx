import { useTranslation } from "@sdm/i18n";
import { useSession } from "../../shell/session-context";
import { TenantOverview } from "./components/TenantOverview";
import { useSpTenants } from "./hooks";
import "./sp-cockpit.css";

/**
 * `/sp/cockpit` — Service Provider landing page. Lists every tenant the
 * caller has `sp_admin` in, with a per-tenant health summary card (open
 * incidents, pending changes, critical shared CIs).
 *
 * Route guard: the entry in `routes/index.tsx` wraps the route with the same
 * `RouteGuard require="..."` helper used by the KB editor — only `sp_admin`
 * roles see this surface. Non-sp_admin callers hit the route guard's 403
 * fallback so deep links from external dashboards don't leak the "shape" of
 * the cockpit.
 */
export default function SpCockpitRoute() {
  const { t } = useTranslation("workspace");
  const { session, status } = useSession();
  const isReady = status === "ready" && !!session;
  const query = useSpTenants(isReady);

  if (!isReady) {
    return (
      <section className="sdm-sp-cockpit-page" data-testid="sp-cockpit-loading">
        <p>{t("sp.cockpit.loading")}</p>
      </section>
    );
  }

  return (
    <section className="sdm-sp-cockpit-page" data-testid="sp-cockpit">
      <header className="sdm-sp-cockpit-header">
        <h1 className="sdm-sp-cockpit-title">{t("sp.cockpit.title")}</h1>
        <p className="sdm-sp-cockpit-subtitle">{t("sp.cockpit.subtitle")}</p>
      </header>

      {query.isPending ? (
        <p className="sdm-sp-cockpit-state" data-testid="sp-cockpit-tenants-loading">
          {t("sp.cockpit.loading")}
        </p>
      ) : query.isError ? (
        <p
          role="alert"
          className="sdm-sp-cockpit-state sdm-sp-cockpit-state--error"
          data-testid="sp-cockpit-error"
        >
          {t("sp.cockpit.error")}
        </p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="sdm-sp-cockpit-state" data-testid="sp-cockpit-empty">
          {t("sp.cockpit.empty")}
        </p>
      ) : (
        <TenantOverview tenants={query.data!} />
      )}
    </section>
  );
}
