import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  EmptyState,
  IllustrationNoSearchResults,
  staggerListRows,
  usePageTransition,
} from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { kbSearchQuery } from "./api";
import { SearchInput } from "./components/SearchInput";
import { SearchResultItem } from "./components/SearchResultItem";
import { SearchResultRowSkeleton } from "./components/Skeletons";
import "./kb.css";

/**
 * `/kb` — KB search (Lucia journey). K.3.E v1.2 polish:
 *
 *   ┌─ Back link
 *   ├─ Hero heading + subtitle
 *   ├─ <SearchInput>     48 px tall, lucide-style inline SVG, debounce 300 ms
 *   ├─ Result count      live region (tabular-nums on the integer)
 *   └─ Results list      `Card variant="interactive"` rows, staggered on mount,
 *                        or `<EmptyState variant="compact">` when the search
 *                        returns nothing (test-id `kb-empty` preserved).
 *
 * Skeleton rows render in place of the row list while the query is
 * pending — no "Loading..." text. Page mount fades in via
 * `usePageTransition` (crossfade only; reduced-motion safe).
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");
const MIN_ROWS_FOR_STAGGER = 3;

export function KbRoute() {
  const { t } = useTranslation("portal");
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const [term, setTerm] = useState("");
  const location = useLocation();
  const { ref: pageRef } = usePageTransition(location.pathname);
  const listRef = useRef<HTMLUListElement | null>(null);

  const query = useQuery({
    ...kbSearchQuery(tenantId, term),
    enabled: session !== null,
  });

  const results = query.data ?? [];
  const hasTerm = term.trim().length > 0;
  const isEmpty = !query.isLoading && !query.isError && hasTerm && results.length === 0;

  // K.1 brief §7 list-item stagger — runs every time the row count changes
  // (new fetch / term change) so freshly inserted rows fade in too.
  useEffect(() => {
    if (results.length >= MIN_ROWS_FOR_STAGGER) {
      staggerListRows(listRef.current);
    }
  }, [results.length]);

  return (
    <section ref={pageRef} className="sdm-kb" data-testid="portal-kb">
      <Link to="/" className="sdm-kb-back" data-testid="kb-back">
        {t("kb.back")}
      </Link>
      <header className="sdm-kb-heading">
        <h1>{t("kb.title")}</h1>
        <p className="sdm-kb-heading-sub">{t("kb.subtitle")}</p>
      </header>

      <SearchInput
        label={t("kb.searchLabel")}
        placeholder={t("kb.searchPlaceholder")}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        busy={query.isFetching}
        onDebouncedChange={setTerm}
      />

      <div className="sdm-kb-result-count" aria-live="polite" data-testid="kb-result-count">
        {query.isLoading
          ? t("kb.loading")
          : query.isError
            ? t("kb.error")
            : t("kb.resultCount", { count: results.length })}
      </div>

      {query.isError ? (
        <p role="alert" className="sdm-kb-error" data-testid="kb-error">
          {t("kb.error")}
        </p>
      ) : query.isLoading ? (
        <ul className="sdm-kb-result-list" aria-busy="true" data-testid="kb-result-list-loading">
          <SearchResultRowSkeleton />
          <SearchResultRowSkeleton />
          <SearchResultRowSkeleton />
        </ul>
      ) : isEmpty ? (
        <EmptyState
          variant="compact"
          illustration={<IllustrationNoSearchResults />}
          title={t("kb.empty.title")}
          cta={
            <Link
              to={`/new-incident?summary=${encodeURIComponent(term.trim())}`}
              data-testid="kb-empty-open-ticket"
            >
              <Button type="button" variant="primary" size="md">
                {t("kb.empty.openTicket")}
              </Button>
            </Link>
          }
          data-testid="kb-empty"
        />
      ) : (
        <ul ref={listRef} className="sdm-kb-result-list" data-testid="kb-result-list">
          {results.map((result) => (
            <li key={result.id} data-row data-testid={`kb-result-row-${result.id}`}>
              <SearchResultItem result={result} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default KbRoute;
