import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { NotFoundElement } from "../../routes/error-boundaries";
import { kbArticleQuery } from "./api";
import { ArticleHeader } from "./components/ArticleHeader";
import { ArticleBody } from "./components/ArticleBody";
import { HelpfulnessVote } from "./components/HelpfulnessVote";
import { RelatedArticles } from "./components/RelatedArticles";
import "./kb.css";

/**
 * `/kb/article/:id` — KB article detail.
 *
 * Composition (top → bottom):
 *   ┌─ Back link to /kb (preserves history.back semantics)
 *   ├─ <ArticleHeader>     title + meta (category, updated, read time)
 *   ├─ <ArticleBody>       lazy-loaded `react-markdown` chunk
 *   ├─ <HelpfulnessVote>   👍 / 👎 + comment
 *   └─ <RelatedArticles>   same-category 3-5 items
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");

export function KbArticleRoute() {
  const { t } = useTranslation("portal");
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;

  const query = useQuery({
    ...kbArticleQuery(tenantId, id ?? ""),
    enabled: session !== null && Boolean(id),
  });

  if (!id) return <NotFoundElement />;

  if (query.isLoading) {
    return (
      <section className="sdm-kb-article" data-testid="portal-kb-article-loading">
        <p className="sdm-kb-article-loading">{t("kb.article.loading")}</p>
      </section>
    );
  }

  if (query.isError) {
    const status = (query.error as { status?: number } | null)?.status;
    if (status === 404) return <NotFoundElement />;
    return (
      <section className="sdm-kb-article" data-testid="portal-kb-article-error" role="alert">
        <p className="sdm-kb-article-error">{t("kb.article.error")}</p>
      </section>
    );
  }

  const article = query.data;
  if (!article) return <NotFoundElement />;

  return (
    <section
      className="sdm-kb-article"
      data-testid="portal-kb-article"
      data-article-id={article.id}
    >
      <Link to="/kb" className="sdm-kb-back" data-testid="kb-article-back">
        {t("kb.article.back")}
      </Link>
      <ArticleHeader article={article} />
      <ArticleBody markdown={article.markdown} />
      <HelpfulnessVote articleId={article.id} />
      <RelatedArticles articles={article.related} />
    </section>
  );
}

export default KbArticleRoute;
