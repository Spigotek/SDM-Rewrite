import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { Can } from "@sdm/auth";
import { Button, Card, Skeleton, usePageTransition } from "@sdm/design-system";
import { useSession } from "../../shell/session-context";
import { NotFoundElement } from "../../routes/error-boundaries";
import { kbArticleQuery } from "./api";
import { ArticleHeader } from "./components/ArticleHeader";
import { ArticleBody } from "./components/ArticleBody";
import { ArticleStats } from "./components/ArticleStats";
import { KbAttachIncidentAction } from "./components/KbAttachIncidentAction";
import "./kb.css";

/**
 * `/kb/article/:id` — K.3.E polish:
 *
 * - The article body, stats, and header sit inside `<Card>` containers so the
 *   surface tokens come from the DS instead of bespoke borders.
 * - The toolbar keeps `kb-article-back` + `kb-article-edit` test-ids; edit is
 *   permission-gated via `<Can permission="kb.write" fallback={null}>`.
 * - Helpfulness footer renders via `ArticleStats` (H.6 contract preserved).
 * - `usePageTransition` runs the K.1 crossfade on route mount.
 */
const TENANT_PLACEHOLDER = toTenantId("__pending__");

export default function KbArticleRoute() {
  const { t } = useTranslation("workspace");
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const roles = session?.roles ?? [];
  const location = useLocation();
  const navigate = useNavigate();
  const { ref: pageRef } = usePageTransition(location.pathname);

  const query = useQuery({
    ...kbArticleQuery(tenantId, id ?? ""),
    enabled: session !== null && Boolean(id),
  });

  if (!id) return <NotFoundElement />;

  if (query.isLoading) {
    return (
      <section
        className="sdm-kb-article"
        data-testid="workspace-kb-article-loading"
        ref={pageRef as React.RefObject<HTMLElement>}
      >
        <Card variant="surface" className="sdm-kb-article-skeleton">
          <Skeleton variant="text" width="64%" height={28} />
          <Skeleton variant="text" width="32%" height={14} />
          <Skeleton variant="block" width="100%" height={160} />
        </Card>
      </section>
    );
  }

  if (query.isError) {
    const status = (query.error as { status?: number } | null)?.status;
    if (status === 404) return <NotFoundElement />;
    return (
      <section
        className="sdm-kb-article"
        data-testid="workspace-kb-article-error"
        role="alert"
        ref={pageRef as React.RefObject<HTMLElement>}
      >
        <p className="sdm-kb-article-state">{t("kb.article.error")}</p>
      </section>
    );
  }

  const article = query.data;
  if (!article) return <NotFoundElement />;

  // Preserve the cross-feature query string when the agent navigates back to
  // `/kb` — keeps the attach-to-ticket banner alive across both views.
  const backHref = `/kb${location.search}`;

  return (
    <section
      className="sdm-kb-article"
      data-testid="workspace-kb-article"
      data-article-id={article.id}
      ref={pageRef as React.RefObject<HTMLElement>}
    >
      <div className="sdm-kb-article-toolbar">
        <Link to={backHref} className="sdm-kb-article-back" data-testid="kb-article-back">
          {t("kb.article.back")}
        </Link>
        <Can roles={roles} permission="kb.write" fallback={null}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="kb-article-edit"
            onClick={() => navigate(`/kb/editor/${encodeURIComponent(article.id)}`)}
          >
            {t("kb.actions.editArticle")}
          </Button>
        </Can>
      </div>
      <KbAttachIncidentAction articleId={article.id} />
      <Card variant="surface" className="sdm-kb-article-card">
        <ArticleHeader article={article} />
        <ArticleBody markdown={article.markdown} />
      </Card>
      <Card variant="surface" className="sdm-kb-article-stats-card">
        <ArticleStats stats={article.stats} />
      </Card>
    </section>
  );
}
