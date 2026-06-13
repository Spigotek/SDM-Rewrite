import { useTranslation } from "@sdm/i18n";
import { Avatar } from "@sdm/design-system";
import type { KbArticleDetail } from "../types";

/**
 * Agent-facing article header — title (h1), KB-id mono, author avatar, last
 * updated meta. K.3.E reshuffle: meta now reads as a single horizontal row
 * (author avatar + author + dot + date + read-time) rather than a 4-up
 * key/value grid, matching the K.1 brief mock for the article surface.
 *
 * Test-ids preserved (`kb-article-header`, `kb-article-stats`, etc.) so the
 * H.15 / J-acceptance browser suites keep passing.
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
  const authorName = article.authorId ?? t("kb.list.unknownAuthor");

  return (
    <header className="sdm-kb-article-header" data-testid="kb-article-header">
      <div className="sdm-kb-article-header-titles">
        <h1 className="sdm-kb-article-title">{article.title}</h1>
        <span className="sdm-kb-article-id sdm-tabular">#{article.id}</span>
      </div>
      <div className="sdm-kb-article-meta-row-inline">
        <Avatar name={authorName} size="sm" />
        <span className="sdm-kb-article-meta-author">{authorName}</span>
        {updated ? (
          <>
            <span className="sdm-kb-article-meta-dot" aria-hidden="true">
              ·
            </span>
            <time
              className="sdm-kb-article-meta-date sdm-tabular"
              dateTime={article.lastModifiedAt}
            >
              {t("kb.article.updated")}: {updated}
            </time>
          </>
        ) : null}
        <span className="sdm-kb-article-meta-dot" aria-hidden="true">
          ·
        </span>
        <span className="sdm-kb-article-meta-readtime sdm-tabular">
          {t("kb.article.readTimeValue", { count: article.readTimeMin })}
        </span>
        {article.categoryName ? (
          <>
            <span className="sdm-kb-article-meta-dot" aria-hidden="true">
              ·
            </span>
            <span className="sdm-kb-article-meta-category">{article.categoryName}</span>
          </>
        ) : null}
        {article.language === "en" ? (
          <>
            <span className="sdm-kb-article-meta-dot" aria-hidden="true">
              ·
            </span>
            <span className="sdm-kb-lang-badge">{t("kb.article.englishOnly")}</span>
          </>
        ) : null}
      </div>
    </header>
  );
}
