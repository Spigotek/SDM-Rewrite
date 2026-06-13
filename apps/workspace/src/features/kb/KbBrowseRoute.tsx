import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { Can } from "@sdm/auth";
import {
  Button,
  Card,
  EmptyState,
  IllustrationNoKbArticles,
  IllustrationNoSearchResults,
  Skeleton,
  TextField,
  staggerListRows,
  usePageTransition,
} from "@sdm/design-system";
import { useSession } from "../../shell/session-context";
import { kbBrowseQuery, kbCategoriesQuery } from "./api";
import { useKbFilters } from "./hooks";
import { KbFilters } from "./components/KbFilters";
import { KbArticleList } from "./components/KbArticleList";
import type { KbBrowseRow, KbFilters as KbFiltersState } from "./types";
import "./kb.css";

/**
 * `/kb` workspace browse — K.3.E redesign.
 *
 * - Hero search input (debounced 300 ms) above the article list.
 * - Article list rows render title + excerpt + author avatar + last-updated.
 * - `KbFilters` (category + language) folded under the hero.
 * - Skeleton placeholder while the browse query is pending.
 * - `usePageTransition` runs a 120 ms fade on route mount per K.1 brief §7.
 * - `staggerListRows` fires once per result-set change (handled in the list
 *   component); rows carry `data-row` so the GSAP selector picks them up.
 *
 * Filter state is URL-driven (`?category=…&language=…`); the hero search input
 * filters client-side over the loaded set — server-side `q` lands when the BFF
 * surfaces it (see API layer).
 */
const EMPTY_ROWS: ReadonlyArray<KbBrowseRow> = [];
const SEARCH_DEBOUNCE_MS = 300;

function applyFilters(
  rows: ReadonlyArray<KbBrowseRow>,
  f: KbFiltersState,
  search: string,
): ReadonlyArray<KbBrowseRow> {
  const needle = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.category && r.categoryId !== f.category) return false;
    if (f.language && r.language !== f.language) return false;
    if (needle) {
      const hay = [r.title, r.categoryName ?? ""].join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export default function KbBrowseRoute() {
  const { t } = useTranslation("workspace");
  const location = useLocation();
  const { session } = useSession();
  const tenantId = session?.tenantId;
  const roles = session?.roles ?? [];
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const attachToTicket = searchParams.get("attachToTicket");

  const { filters, setCategory, setLanguage, reset } = useKbFilters();

  // Local hero search state. Debounced through `debouncedSearch` so each
  // keystroke does not retrigger the staggerListRows animation.
  const [rawSearch, setRawSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(rawSearch), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [rawSearch]);

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
  const filtered = useMemo(
    () => applyFilters(rows, filters, debouncedSearch),
    [rows, filters, debouncedSearch],
  );

  const heroRef = useRef<HTMLDivElement | null>(null);
  const { ref: pageRef } = usePageTransition(location.pathname);

  // Stagger the popular-tag chip row on hero mount — keeps the K.3 motion
  // vocabulary consistent with the queue/portal hero feel.
  useEffect(() => {
    staggerListRows(heroRef.current, { selector: "[data-row]" });
  }, []);

  return (
    <section
      data-testid="workspace-kb"
      className="sdm-kb-page"
      ref={pageRef as React.RefObject<HTMLElement>}
    >
      <header className="sdm-kb-header" ref={heroRef}>
        <div className="sdm-kb-header-titles">
          <h1 className="sdm-kb-title">{t("kb.title")}</h1>
          <p className="sdm-kb-subtitle">{t("kb.subtitle")}</p>
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

      <Card variant="surface" className="sdm-kb-hero-card">
        <div className="sdm-kb-hero">
          <TextField
            label={t("kb.hero.searchLabel")}
            srOnlyLabel
            type="search"
            placeholder={t("kb.hero.searchPlaceholder")}
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            leadingIcon={<Search size={16} aria-hidden="true" />}
            data-testid="kb-hero-search"
            autoComplete="off"
          />
        </div>
      </Card>

      {browse.isPending ? (
        <div className="sdm-kb-skeleton-stack" data-testid="kb-loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} variant="surface" className="sdm-kb-skeleton-row">
              <Skeleton variant="text" width="42%" height={18} />
              <Skeleton variant="text" width="82%" height={14} />
              <Skeleton variant="text" width="32%" height={12} />
            </Card>
          ))}
        </div>
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
            <EmptyState
              variant="compact"
              illustration={<IllustrationNoSearchResults />}
              title={t("kb.filters.noResults")}
              className="sdm-kb-state"
              data-testid="kb-filtered-empty"
            />
          ) : (
            <KbArticleList rows={filtered} />
          )}
        </>
      )}
    </section>
  );
}
