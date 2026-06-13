import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, IllustrationNoKbArticles } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { kbSearchQuery } from "./api";
import { SearchInput } from "./components/SearchInput";
import { SearchResultItem } from "./components/SearchResultItem";
import "./kb.css";

/**
 * `/kb` — KB search (Lucia journey).
 *
 * Layout (mobile-first, top → bottom):
 *   ┌─ Back link
 *   ├─ Heading + subtitle
 *   ├─ <SearchInput>   debounce 300 ms, autoFocus
 *   ├─ Result count    live region
 *   └─ Results list    or empty state with "open ticket" CTA
 *
 * The list is fetched against `/api/kb?q=<term>`. An empty term lists
 * every published article in the tenant; the empty-state branch fires
 * only when the term is non-empty AND the list is empty (per microcopy:
 * "Nič som nenašiel...").
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");

export function KbRoute() {
  const { t } = useTranslation("portal");
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const [term, setTerm] = useState("");

  const query = useQuery({
    ...kbSearchQuery(tenantId, term),
    enabled: session !== null,
  });

  const results = query.data ?? [];
  const hasTerm = term.trim().length > 0;
  const isEmpty = !query.isLoading && !query.isError && hasTerm && results.length === 0;

  return (
    <section className="sdm-kb" data-testid="portal-kb">
      <Link to="/" className="sdm-kb-back" data-testid="kb-back">
        {t("kb.back")}
      </Link>
      <header className="sdm-kb-heading">
        <h1>{t("kb.title")}</h1>
        <p className="sdm-kb-heading-sub">{t("kb.subtitle")}</p>
      </header>

      {/* Auto-focus the search field on landing — KB search is the primary
          action of `/kb` (wireframe `portal/05-kb-search.md` Search interakcie
          "Search live"). The route is reached intentionally, so the focus
          shift is expected. */}
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
      ) : isEmpty ? (
        <EmptyState
          variant="hero"
          illustration={<IllustrationNoKbArticles />}
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
        <ul className="sdm-kb-result-list" data-testid="kb-result-list">
          {results.map((result) => (
            <li key={result.id}>
              <SearchResultItem result={result} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default KbRoute;
