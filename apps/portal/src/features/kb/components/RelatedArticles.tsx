import { Link } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import type { KbRelatedArticle } from "../types";

/**
 * Bottom-of-article related-articles list. Hidden when empty — adding a
 * blank section would just be noise.
 */
export function RelatedArticles({ articles }: { articles: ReadonlyArray<KbRelatedArticle> }) {
  const { t } = useTranslation("portal");
  if (articles.length === 0) return null;

  return (
    <section className="sdm-kb-related" data-testid="kb-related">
      <h2 className="sdm-kb-related-title">{t("kb.related.title")}</h2>
      <ul className="sdm-kb-related-list">
        {articles.map((article) => (
          <li key={article.id} className="sdm-kb-related-item">
            <Link
              to={`/kb/article/${encodeURIComponent(article.id)}`}
              className="sdm-kb-related-link"
              data-testid={`kb-related-${article.id}`}
            >
              <span className="sdm-kb-related-link-title">{article.title}</span>
              <span className="sdm-kb-related-link-meta">
                {t("kb.result.readTime", { count: article.readTimeMin })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
