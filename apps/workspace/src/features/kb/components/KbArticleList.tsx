import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import { Avatar, staggerListRows } from "@sdm/design-system";
import type { KbBrowseRow } from "../types";

/**
 * Workspace KB article list — Card-row layout (K.3.E redesign).
 *
 * Each row is a `<Link>` to `/kb/article/:id` so a11y semantics + focus
 * management land for free. The outer `<ul>` and inner anchor still carry
 * the legacy `kb-table` / `kb-row` test-ids so the existing browser test
 * suite (H.15, J-acceptance) keeps passing.
 *
 * Rows expose `data-row` so `staggerListRows` runs the 20 ms-per-row enter
 * animation on every result-set change. `tabular-nums` applied to dates +
 * helpfulness % per K.1 brief §3.
 */
function formatDate(iso: string, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

function formatRatio(ratio: number | null, locale: string): string {
  if (ratio === null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}

export interface KbArticleListProps {
  readonly rows: ReadonlyArray<KbBrowseRow>;
}

export function KbArticleList({ rows }: KbArticleListProps) {
  const { t, i18n } = useTranslation("workspace");
  const listRef = useRef<HTMLUListElement | null>(null);

  // Re-run the stagger any time the visible set changes (filter, search).
  useEffect(() => {
    staggerListRows(listRef.current);
  }, [rows.length]);

  return (
    <ul
      ref={listRef}
      className="sdm-kb-article-list"
      data-testid="kb-table"
      aria-label={t("kb.list.ariaLabel")}
    >
      {rows.map((r) => {
        const authorName = r.categoryName ?? t("kb.list.unknownAuthor");
        return (
          <li key={r.id} data-row data-row-id={r.id}>
            <Link
              to={`/kb/article/${encodeURIComponent(r.id)}`}
              className="sdm-kb-article-list-item"
              data-testid="kb-row"
              data-row-id={r.id}
            >
              <div className="sdm-kb-article-list-main">
                <span className="sdm-kb-article-list-title" title={r.title}>
                  {r.title}
                </span>
                <p className="sdm-kb-article-list-excerpt">
                  {r.categoryName ?? t("kb.list.noExcerpt")}
                </p>
                <div className="sdm-kb-article-list-meta">
                  <Avatar name={authorName} size="xs" />
                  <span className="sdm-kb-article-list-author">
                    {t("kb.list.byAuthor", { author: authorName })}
                  </span>
                  <span className="sdm-kb-article-list-dot" aria-hidden="true">
                    ·
                  </span>
                  <time
                    className="sdm-kb-article-list-date sdm-tabular"
                    dateTime={r.lastModifiedAt}
                  >
                    {formatDate(r.lastModifiedAt, i18n.language)}
                  </time>
                </div>
              </div>
              <div className="sdm-kb-article-list-aside">
                <span
                  className="sdm-kb-article-list-ratio sdm-tabular"
                  data-testid="kb-row-ratio"
                  data-ratio={r.helpfulnessRatio ?? ""}
                >
                  {formatRatio(r.helpfulnessRatio, i18n.language)}
                </span>
                <span className="sdm-kb-article-list-views sdm-tabular">
                  {new Intl.NumberFormat(i18n.language).format(r.viewCount)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
