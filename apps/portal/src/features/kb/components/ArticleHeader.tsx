import { useTranslation } from "@sdm/i18n";
import type { KbArticleDetail } from "../types";

/**
 * KB article header — title is the page `<h1>`, meta in a `<dl>` so the
 * key/value pairs survive screen-reader navigation (per
 * `components.md §KbArticleHeader`).
 */
export function ArticleHeader({ article }: { article: KbArticleDetail }) {
  const { t, i18n } = useTranslation("portal");
  const formatter = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const updated = article.updatedAt ? formatter.format(new Date(article.updatedAt)) : null;

  return (
    <header className="sdm-kb-article-header" data-testid="kb-article-header">
      <h1 className="sdm-kb-article-title">{article.title}</h1>
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
