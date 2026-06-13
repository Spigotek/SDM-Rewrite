import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Tile, staggerListRows } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import type { KbRelatedArticle } from "../types";

/**
 * Bottom-of-article related-articles section. K.3.E v1.2 — rendered as a
 * 3-up `Tile` grid (K.1 brief §6.3 `kb` variant). Hidden when empty.
 *
 * Navigation goes through `useNavigate` so the SPA owns the transition;
 * modifier keys (cmd/ctrl click, middle-click) fall through to the native
 * `<a>` behaviour. The `Tile` primitive is already an `<a>` when given
 * `href`, so the keyboard / a11y story is identical to a plain link.
 *
 * Lucide-style inline SVG for the book-open glyph (portal has no
 * `lucide-react` dep).
 */
function BookOpenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

export function RelatedArticles({ articles }: { articles: ReadonlyArray<KbRelatedArticle> }) {
  const { t } = useTranslation("portal");
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement | null>(null);

  // K.1 §7 — only stagger when there are enough rows for the effect to read.
  useEffect(() => {
    if (articles.length >= 3) {
      staggerListRows(gridRef.current);
    }
  }, [articles.length]);

  if (articles.length === 0) return null;

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>, id: string): void {
    // Honour modifier keys + middle-click — fall through to native handling.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(`/kb/article/${encodeURIComponent(id)}`);
  }

  return (
    <section className="sdm-kb-related" data-testid="kb-related">
      <h2 className="sdm-kb-related-title">{t("kb.related.title")}</h2>
      <div ref={gridRef} className="sdm-kb-related-grid">
        {articles.map((article) => (
          <Tile
            key={article.id}
            data-row
            href={`/kb/article/${encodeURIComponent(article.id)}`}
            variant="kb"
            icon={<BookOpenIcon />}
            title={article.title}
            description={t("kb.result.readTime", { count: article.readTimeMin })}
            data-testid={`kb-related-${article.id}`}
            onClick={(event) => handleClick(event, article.id)}
          />
        ))}
      </div>
    </section>
  );
}
