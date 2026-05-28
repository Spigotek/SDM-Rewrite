import { Suspense, lazy } from "react";
import { useTranslation } from "@sdm/i18n";

/**
 * KB article body — wraps the lazy-loaded `MarkdownRenderer` chunk so the
 * `react-markdown` + `remark-gfm` + `rehype-sanitize` stack is only paid
 * for on `/kb/article/:id`. The search list (and every non-article
 * portal route) is markdown-free.
 *
 * Suspense fallback is a one-liner — the article header above is already
 * visible so the page never collapses while the chunk loads.
 */
const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

export function ArticleBody({ markdown }: { markdown: string }) {
  const { t } = useTranslation("portal");

  if (markdown.trim().length === 0) {
    return (
      <p className="sdm-kb-article-empty" data-testid="kb-article-empty">
        {t("kb.article.empty")}
      </p>
    );
  }

  return (
    <article className="sdm-kb-article-body" data-testid="kb-article-body">
      <Suspense
        fallback={
          <p className="sdm-kb-article-loading" data-testid="kb-article-body-loading">
            {t("kb.article.loadingBody")}
          </p>
        }
      >
        <MarkdownRenderer content={markdown} />
      </Suspense>
    </article>
  );
}
