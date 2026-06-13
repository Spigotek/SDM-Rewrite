import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, usePageTransition } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { NotFoundElement } from "../../routes/error-boundaries";
import { kbArticleQuery } from "./api";
import { ArticleHeader } from "./components/ArticleHeader";
import { ArticleBody } from "./components/ArticleBody";
import { HelpfulnessVote } from "./components/HelpfulnessVote";
import { RelatedArticles } from "./components/RelatedArticles";
import { ArticleSkeleton } from "./components/Skeletons";
import "./kb.css";

/**
 * `/kb/article/:id` — KB article reader. K.3.E v1.2:
 *
 *   ┌─ Back link to /kb
 *   ├─ Card variant="surface" wrapping the whole reader:
 *   │   ├─ <ArticleHeader>     h1 30 px + meta (category, updated, read time)
 *   │   ├─ <ArticleBody>       lazy-loaded react-markdown chunk
 *   │   ├─ <HelpfulnessVote>   thumbs-up / -down IconButtons + counts
 *   │   └─ <RelatedArticles>   3-up Tile grid (when data is available)
 *
 * `usePageTransition` runs the crossfade on mount; the skeleton placeholder
 * replaces the "Načítavam článok…" text the route used to render.
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");

export function KbArticleRoute() {
  const { t } = useTranslation("portal");
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const location = useLocation();
  const { ref: pageRef } = usePageTransition(location.pathname);

  const query = useQuery({
    ...kbArticleQuery(tenantId, id ?? ""),
    enabled: session !== null && Boolean(id),
  });

  if (!id) return <NotFoundElement />;

  if (query.isLoading) {
    return (
      <section ref={pageRef} className="sdm-kb-article" data-testid="portal-kb-article-loading">
        <Link to="/kb" className="sdm-kb-back" data-testid="kb-article-back">
          {t("kb.article.back")}
        </Link>
        <Card variant="surface" className="sdm-kb-article-card">
          <ArticleSkeleton />
        </Card>
      </section>
    );
  }

  if (query.isError) {
    const status = (query.error as { status?: number } | null)?.status;
    if (status === 404) return <NotFoundElement />;
    return (
      <section
        ref={pageRef}
        className="sdm-kb-article"
        data-testid="portal-kb-article-error"
        role="alert"
      >
        <p className="sdm-kb-article-error">{t("kb.article.error")}</p>
      </section>
    );
  }

  const article = query.data;
  if (!article) return <NotFoundElement />;

  return (
    <section
      ref={pageRef}
      className="sdm-kb-article"
      data-testid="portal-kb-article"
      data-article-id={article.id}
    >
      <Link to="/kb" className="sdm-kb-back" data-testid="kb-article-back">
        {t("kb.article.back")}
      </Link>
      <Card variant="surface" className="sdm-kb-article-card">
        <ArticleHeader article={article} />
        <ArticleBody markdown={article.markdown} />
        <HelpfulnessVote articleId={article.id} helpfulCount={article.helpfulCount} />
      </Card>
      <RelatedArticles articles={article.related} />
    </section>
  );
}

export default KbArticleRoute;
