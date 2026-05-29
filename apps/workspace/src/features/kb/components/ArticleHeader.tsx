import { useTranslation } from "@sdm/i18n";
import type { KbArticleDetail } from "../types";

/**
 * Agent-facing article header — title is the page `<h1>`, meta is a `<dl>` so
 * the key/value pairs survive screen-reader navigation. Layout follows the
 * wireframe `workspace/04-kb-editor.md §read mode` — more metadata visible
 * than the portal H.6 surface (author + last updated + category).
 */
export function ArticleHeader({ article }: { article: KbArticleDetail }) {
  const { t, i18n } = useTranslation("workspace");
  const formatter = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const updated = article.lastModifiedAt
    ? formatter.format(new Date(article.lastModifiedAt))
    : null;

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
        {article.authorId ? (
          <div className="sdm-kb-article-meta-row">
            <dt>{t("kb.article.author")}</dt>
            <dd>{article.authorId}</dd>
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
          <dd>{t("kb.article.readTimeValue", { count: article.readTimeMin })}</dd>
        </div>
        {article.language === "en" ? (
          <div className="sdm-kb-article-meta-row">
            <dt>{t("kb.article.language")}</dt>
            <dd>
              <span className="sdm-kb-lang-badge">{t("kb.article.englishOnly")}</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}
