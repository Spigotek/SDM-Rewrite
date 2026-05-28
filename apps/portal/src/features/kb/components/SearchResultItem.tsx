import { Link } from "react-router-dom";
import { Card } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import type { KbSearchResult } from "../types";

/**
 * One row in the KB search results list. Renders title + snippet + a meta
 * footer (category · helpful count · read time). Click navigates to the
 * article detail; preserves the search term in `location.state` so the
 * "back to results" link can restore it.
 */
export function SearchResultItem({ result }: { result: KbSearchResult }) {
  const { t } = useTranslation("portal");

  return (
    <Link
      to={`/kb/article/${encodeURIComponent(result.id)}`}
      className="sdm-kb-result-link"
      data-testid={`kb-result-${result.id}`}
    >
      <Card variant="interactive" className="sdm-kb-result-card">
        <h3 className="sdm-kb-result-title">{result.title}</h3>
        {result.snippet ? <p className="sdm-kb-result-snippet">{result.snippet}</p> : null}
        <p className="sdm-kb-result-meta">
          {result.categoryName ? (
            <>
              <span className="sdm-kb-result-meta-category">{result.categoryName}</span>
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          <span>{t("kb.result.helpfulCount", { count: result.helpfulCount })}</span>
          <span aria-hidden="true"> · </span>
          <span>{t("kb.result.readTime", { count: result.readTimeMin })}</span>
          {result.language === "en" ? (
            <>
              <span aria-hidden="true"> · </span>
              <span className="sdm-kb-result-lang-badge">{t("kb.result.englishOnly")}</span>
            </>
          ) : null}
        </p>
      </Card>
    </Link>
  );
}
