/**
 * Workspace `/queue` placeholder. H.8 replaces with the real queue table.
 *
 * Preserves the smoke-test contract from E.3 (`tools/browser-test/scenarios/
 * smoke-workspace.spec.ts`): the `SDM Workspace` heading + the `active-tenant`
 * testid remain so the existing smoke test runs unchanged. `/` redirects here
 * so the smoke test's `goto("/")` still lands on the heading.
 */

import { useTranslation } from "@sdm/i18n";
import { useSession } from "../../shell/session-context";

export default function QueueRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  if (!session) return null;
  return (
    <section data-testid="workspace-queue">
      <h1>SDM Workspace</h1>
      <p>
        {t("placeholders.activeTenant")}{" "}
        <strong data-testid="active-tenant">{session.tenantId}</strong>
      </p>
      <p className="sdm-skeleton-hint">{t("placeholders.queue")}</p>
    </section>
  );
}
