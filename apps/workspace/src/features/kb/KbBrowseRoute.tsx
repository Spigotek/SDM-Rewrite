import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { Can } from "@sdm/auth";
import { Button, EmptyState, IllustrationNoKbArticles } from "@sdm/design-system";
import { useSession } from "../../shell/session-context";
import { kbBrowseQuery, kbCategoriesQuery } from "./api";
import { useKbFilters } from "./hooks";
import { KbFilters } from "./components/KbFilters";
import { KbBrowseList } from "./components/KbBrowseList";
import type { KbBrowseRow, KbFilters as KbFiltersState } from "./types";
import "./kb.css";

/**
 * `/kb` workspace browse — Jana (kb_editor) read-only MVP.
 *
 * Layout:
 *   - Header with title + tenant hint (matches `/changes`, `/problems`,
 *     `/cmdb` shape).
 *   - "New article" CTA is gated on `kb.write` via `<Can permission="kb.write"
 *     fallback={null}>` — fully hidden for read-only personas. Per H.15 the
 *     editor surface is v1+; the action navigates to a placeholder route
 *     today (kept for when the TipTap editor lands).
 *   - KbFilters (category dropdown + language chips) + KbBrowseList
 *     (TanStack Table v8 DataTable).
 *
 * Filter state is URL-driven (`?category=…&language=…`) so deep links survive
 * refresh; the `attachToTicket` URL param flows through to the article view
 * unchanged via plain anchor traversal (TanStack Table row navigation
 * preserves the search string).
 */
const EMPTY_ROWS: ReadonlyArray<KbBrowseRow> = [];

function applyFilters(
  rows: ReadonlyArray<KbBrowseRow>,
  f: KbFiltersState,
): ReadonlyArray<KbBrowseRow> {
  return rows.filter((r) => {
    if (f.category && r.categoryId !== f.category) return false;
    if (f.language && r.language !== f.language) return false;
    return true;
  });
}

export default function KbBrowseRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const tenantId = session?.tenantId;
  const roles = session?.roles ?? [];
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const attachToTicket = searchParams.get("attachToTicket");

  const { filters, setCategory, setLanguage, reset } = useKbFilters();

  const queryTenantId = tenantId ?? toTenantId("__pending__");
  const browse = useQuery({
    ...kbBrowseQuery(queryTenantId),
    enabled: !!tenantId,
  });
  const categories = useQuery({
    ...kbCategoriesQuery(queryTenantId),
    enabled: !!tenantId,
  });

  const rows: ReadonlyArray<KbBrowseRow> = useMemo(() => browse.data ?? EMPTY_ROWS, [browse.data]);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  return (
    <section data-testid="workspace-kb" className="sdm-kb-page">
      <header className="sdm-kb-header">
        <div className="sdm-kb-header-titles">
          <h1 className="sdm-kb-title">{t("kb.title")}</h1>
          {attachToTicket ? (
            <p
              className="sdm-kb-attach-banner"
              data-testid="kb-attach-banner"
              data-ticket-ref={attachToTicket}
            >
              {t("kb.attach.browseBanner", { ticket: attachToTicket })}
            </p>
          ) : null}
        </div>
        <div className="sdm-kb-header-meta">
          <span className="sdm-kb-tenant-hint">
            {t("placeholders.activeTenant")}{" "}
            <strong data-testid="active-tenant">{tenantId ?? ""}</strong>
          </span>
          <Can roles={roles} permission="kb.analytics" fallback={null}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="kb-analytics"
              onClick={() => navigate("/kb/analytics")}
            >
              {t("kb.actions.analytics")}
            </Button>
          </Can>
          <Can roles={roles} permission="kb.write" fallback={null}>
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="kb-new-article"
              onClick={() => navigate("/kb/editor")}
            >
              {t("kb.actions.newArticle")}
            </Button>
          </Can>
        </div>
      </header>

      {browse.isPending ? (
        <p className="sdm-kb-state" data-testid="kb-loading">
          {t("kb.loading")}
        </p>
      ) : browse.isError ? (
        <p role="alert" className="sdm-kb-state sdm-kb-state--error" data-testid="kb-error">
          {t("kb.error")}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="hero"
          illustration={<IllustrationNoKbArticles />}
          title={t("kb.emptyTitle")}
          description={t("kb.empty")}
          cta={
            <Can roles={roles} permission="kb.write" fallback={null}>
              <Button
                type="button"
                variant="primary"
                size="md"
                data-testid="kb-empty-new-article"
                onClick={() => navigate("/kb/editor")}
              >
                {t("kb.actions.newArticle")}
              </Button>
            </Can>
          }
          className="sdm-kb-state"
          data-testid="kb-empty"
        />
      ) : (
        <>
          <KbFilters
            rows={rows}
            categories={categories.data ?? []}
            filters={filters}
            totalCount={rows.length}
            visibleCount={filtered.length}
            onSelectCategory={setCategory}
            onSelectLanguage={setLanguage}
            onReset={reset}
          />
          {filtered.length === 0 ? (
            <p className="sdm-kb-state" data-testid="kb-filtered-empty">
              {t("kb.filters.noResults")}
            </p>
          ) : (
            <KbBrowseList rows={filtered} />
          )}
        </>
      )}
    </section>
  );
}
