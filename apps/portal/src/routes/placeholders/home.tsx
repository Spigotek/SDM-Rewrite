/**
 * Portal `/` placeholder. H.2 replaces this with the real home dashboard.
 *
 * Preserves the smoke-test contract from E.3 (`tools/browser-test/scenarios/
 * smoke-portal.spec.ts`): the `SDM Portal` heading + the `active-tenant`
 * testid remain so the existing smoke test runs unchanged.
 */

import { useTranslation } from "@sdm/i18n";
import { useSession } from "../../shell/session-context";

export default function HomeRoute() {
  const { t } = useTranslation("portal");
  const { session } = useSession();
  if (!session) return null;
  return (
    <section data-testid="portal-home">
      <h1>SDM Portal</h1>
      <p>
        {t("placeholders.activeTenant")}{" "}
        <strong data-testid="active-tenant">{session.tenantId}</strong>
      </p>
      <p className="sdm-skeleton-hint">{t("placeholders.home")}</p>
    </section>
  );
}
