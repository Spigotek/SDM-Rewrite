import { Suspense, lazy } from "react";
import { useTranslation } from "@sdm/i18n";

/**
 * KB article body — wraps the lazy-loaded `MarkdownRenderer` chunk so the
 * `react-markdown` + `remark-gfm` + `rehype-sanitize` stack lands in
 * `vendor-markdown` and the browse list (`/kb`) + the workspace shell pay
 * zero markdown bundle cost up front. Mirror of the portal H.6 ArticleBody.
 */
const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

export function ArticleBody({ markdown }: { markdown: string }) {
  const { t } = useTranslation("workspace");

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
