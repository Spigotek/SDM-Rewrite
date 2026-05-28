import { Link } from "react-router-dom";
import { Card } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import type { KbSuggestion } from "../types";

/**
 * Top-N KB article suggestions. Renders nothing when the BFF returns an
 * empty list (the empty hero alone covers the "nothing here" case — adding
 * a second empty card would just be noise).
 */
export function KbSuggestions({ suggestions }: { suggestions: ReadonlyArray<KbSuggestion> }) {
  const { t } = useTranslation("portal");
  if (suggestions.length === 0) return null;

  return (
    <section className="sdm-home-section" data-testid="home-kb-suggestions">
      <header className="sdm-home-section-head">
        <h2 className="sdm-home-section-title">{t("home.kb.title")}</h2>
        <Link to="/kb" className="sdm-home-section-link" data-testid="home-kb-all">
          {t("home.kb.seeAll")}
        </Link>
      </header>
      <ul className="sdm-home-kb-list">
        {suggestions.map((article) => (
          <li key={article.id} className="sdm-home-kb-item">
            <Link
              to={`/kb/article/${encodeURIComponent(article.id)}`}
              className="sdm-home-kb-link"
              data-testid={`home-kb-${article.id}`}
            >
              <Card variant="surface" className="sdm-home-kb-card">
                <h3 className="sdm-home-kb-title">{article.title}</h3>
                {article.excerpt ? <p className="sdm-home-kb-excerpt">{article.excerpt}</p> : null}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
