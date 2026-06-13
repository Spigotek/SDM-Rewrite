import { Link } from "react-router-dom";
import { Card } from "@sdm/design-system";
import { formatRelative, useLocale, useTranslation } from "@sdm/i18n";
import type { KbSearchResult } from "../types";

/**
 * One row in the KB search results list. K.3.E (v1.2) — rebuilt around an
 * interactive `Card` with title + excerpt + meta strip (last-updated +
 * thumbs-up count + read time + category).
 *
 * Lucide-style inline SVG for the thumbs-up glyph; portal has no
 * `lucide-react` dep, so we follow the same convention as
 * `KbSearchBar.tsx` and the top-bar.
 */
function ThumbsUpIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10a4 4 0 0 0 .27-.62L11 3a1.7 1.7 0 0 1 3 0c.85 1.46 1 3.34 1 4.88Z" />
    </svg>
  );
}

export function SearchResultItem({ result }: { result: KbSearchResult }) {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");

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
          {result.updatedAt ? (
            <>
              <time className="sdm-kb-result-meta-time" dateTime={result.updatedAt}>
                {formatRelative(result.updatedAt, locale)}
              </time>
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          <span className="sdm-kb-result-meta-helpful" data-helpful-count={result.helpfulCount}>
            <ThumbsUpIcon />
            <span className="sdm-kb-result-meta-helpful-count">{result.helpfulCount}</span>
            <span className="sdm-visually-hidden">
              {t("kb.result.helpfulCount", { count: result.helpfulCount })}
            </span>
          </span>
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
