import { Link } from "react-router-dom";
import { Card } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";

/**
 * Two primary CTAs — "Report a problem" → `/new-incident`, "Request something"
 * → `/catalog`. The wireframe (`01-home-dashboard.md`) shows three cards
 * including a KB shortcut, but the KB destination already lives at the bottom
 * of the dashboard as a content panel (`<KbSuggestions />`), so we keep the
 * top band at two cards for visual balance + reduced cognitive load.
 *
 * Layout: stacked single column < 640 px, side-by-side ≥ 640 px (controlled
 * by `.sdm-home-actions` grid in `home.css`).
 */
export function ActionCards() {
  const { t } = useTranslation("portal");
  return (
    <section
      className="sdm-home-actions"
      data-testid="home-action-cards"
      aria-label={t("home.actions.ariaLabel")}
    >
      <Link
        to="/new-incident"
        className="sdm-home-action-link"
        data-testid="home-action-new-incident"
      >
        <Card variant="interactive" className="sdm-home-action-card">
          <h2 className="sdm-home-action-title">{t("home.actions.newIncident.title")}</h2>
          <p className="sdm-home-action-body">{t("home.actions.newIncident.body")}</p>
        </Card>
      </Link>
      <Link to="/catalog" className="sdm-home-action-link" data-testid="home-action-new-request">
        <Card variant="interactive" className="sdm-home-action-card">
          <h2 className="sdm-home-action-title">{t("home.actions.newRequest.title")}</h2>
          <p className="sdm-home-action-body">{t("home.actions.newRequest.body")}</p>
        </Card>
      </Link>
    </section>
  );
}
