import { useNavigate } from "react-router-dom";
import { Tile } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";

/**
 * 3-up Tile strip — Lucia's primary CTAs (K.1 brief §10.1, row 3):
 *   - Nahlásiť problém      → /new-incident
 *   - Hardvér / Softvér     → /catalog
 *   - Reset hesla           → /new-incident?template=password-reset
 *
 * Tiles use the design-system `quick-action` variant (40 px icon badge +
 * title + one-line description + chevron). The design-system `Tile`
 * primitive renders an `<a>` when `href` is provided — that does a full
 * page navigation. Portal is an SPA so we render `Tile` as a button and
 * dispatch through `useNavigate` to keep the React Router boundary intact.
 *
 * Icons are emoji to match the brief's mockup; the rest of the portal
 * already uses emoji for catalog categories so the visual language stays
 * consistent (no new lucide-react dep on portal).
 */
export function QuickActions() {
  const { t } = useTranslation("portal");
  const navigate = useNavigate();
  return (
    <section
      className="sdm-home-quick-actions"
      data-testid="home-quick-actions"
      aria-label={t("home.quickActions.ariaLabel")}
    >
      <Tile
        variant="quick-action"
        icon={<span aria-hidden="true">📧</span>}
        title={t("home.quickActions.report.title")}
        description={t("home.quickActions.report.body")}
        onClick={() => navigate("/new-incident")}
        data-testid="home-quick-action-report"
      />
      <Tile
        variant="quick-action"
        icon={<span aria-hidden="true">💻</span>}
        title={t("home.quickActions.catalog.title")}
        description={t("home.quickActions.catalog.body")}
        onClick={() => navigate("/catalog")}
        data-testid="home-quick-action-catalog"
      />
      <Tile
        variant="quick-action"
        icon={<span aria-hidden="true">🔑</span>}
        title={t("home.quickActions.password.title")}
        description={t("home.quickActions.password.body")}
        onClick={() => navigate("/new-incident?template=password-reset")}
        data-testid="home-quick-action-password"
      />
    </section>
  );
}
