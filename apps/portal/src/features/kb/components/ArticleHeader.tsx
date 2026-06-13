import { useLocale, useTranslation } from "@sdm/i18n";
import type { KbArticleDetail } from "../types";

/**
 * KB article header — title is the page `<h1>`, meta in a `<dl>` so the
 * key/value pairs survive screen-reader navigation (per
 * `components.md §KbArticleHeader`).
 *
 * Locale source: `useLocale("portal")` — the portal-wide convention. The
 * critical-path i18n shim (`i18n-portal.ts`) returns `i18n: null` from
 * `useTranslation` before `vendor-i18n` hydrates, so reading `i18n.language`
 * crashes on the first render of `/kb/article/:id` whenever the markdown
 * route chunk lands ahead of the i18n chunk (reproducible on chromium and
 * firefox; webkit's chunk scheduler happens to mask it). `useLocale` is a
 * stable contract regardless of hydration phase.
 */
export function ArticleHeader({ article }: { article: KbArticleDetail }) {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");
  const formatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const updated = article.updatedAt ? formatter.format(new Date(article.updatedAt)) : null;

  return (
    <header className="sdm-kb-article-header" data-testid="kb-article-header">
      <h1 className="sdm-kb-article-title sdm-heading-serif">{article.title}</h1>
      <dl className="sdm-kb-article-meta">
        {article.categoryName ? (
          <div className="sdm-kb-article-meta-row">
            <dt>{t("kb.article.category")}</dt>
            <dd>{article.categoryName}</dd>
          </div>
        ) : null}
        {updated ? (
          <div className="sdm-kb-article-meta-row">
            <dt>{t("kb.article.updated")}</dt>
            <dd>{updated}</dd>
          </div>
        ) : null}
        <div className="sdm-kb-article-meta-row">
          <dt>{t("kb.article.readTime")}</dt>
          <dd>{t("kb.result.readTime", { count: article.readTimeMin })}</dd>
        </div>
        {article.language === "en" ? (
          <div className="sdm-kb-article-meta-row">
            <dt>{t("kb.article.language")}</dt>
            <dd>
              <span className="sdm-kb-result-lang-badge">{t("kb.result.englishOnly")}</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}
