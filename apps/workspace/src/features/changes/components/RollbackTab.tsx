import { Suspense, lazy } from "react";
import { useTranslation } from "@sdm/i18n";
import type { ChangeDetail } from "../types";

/**
 * Rollback tab — renders `rollback_plan` as sanitized markdown via a lazy
 * `MarkdownRenderer` chunk so the `react-markdown` stack lives in the
 * `vendor-markdown` chunk and is only paid for once an agent actually opens
 * a change. The list page (`/changes`) and the other tabs stay markdown-free.
 *
 * Empty rollback ⇒ explicit empty state. H.11 will gate the Approve action
 * on `rollbackPlan != null` per wireframe `03-change-calendar.md §Mobile`
 * ("Rollback plan: ✅ provided") + AC #11 alternate "rollback empty ⇒
 * Approve disabled".
 */
const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

export function RollbackTab({ detail }: { readonly detail: ChangeDetail }) {
  const { t } = useTranslation("workspace");
  const plan = detail.rollbackPlan;

  return (
    <section
      role="tabpanel"
      id="change-tabpanel-rollback"
      aria-labelledby="change-tab-rollback"
      data-testid="change-tabpanel-rollback"
      className="sdm-change-tabpanel"
    >
      <h2>{t("changes.rollback.title")}</h2>
      {plan === null || plan.trim().length === 0 ? (
        <p className="sdm-change-detail-empty" data-testid="change-rollback-empty">
          {t("changes.rollback.empty")}
        </p>
      ) : (
        <article className="sdm-change-rollback-body" data-testid="change-rollback-body">
          <Suspense
            fallback={
              <p className="sdm-change-rollback-loading" data-testid="change-rollback-loading">
                {t("changes.rollback.loading")}
              </p>
            }
          >
            <MarkdownRenderer content={plan} />
          </Suspense>
        </article>
      )}
    </section>
  );
}
