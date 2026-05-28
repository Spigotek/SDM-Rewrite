import { Link } from "react-router-dom";
import { Button } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import type { Incident } from "@sdm/domain";

/**
 * `SuccessScreen` — the "Po odoslaní" panel from `02-new-ticket.md`.
 *
 * Three CTAs, ordered by importance for the requester journey:
 *   1. **View ticket** (primary) — `/tickets/incident:<id>` opens the H.4
 *      detail page so Lucia can immediately see the helpdesk-visible state.
 *   2. **Report another** (secondary) — calls `onReportAnother` to remount
 *      `NewIncidentForm` with cleared values.
 *   3. **Done** (link) — back to `/`, sibling card to the home dashboard.
 *
 * The success ID is rendered as the ticket `ref` (e.g. `IN-10042`), which is
 * what the helpdesk uses verbally; the canonical entity URL still uses the
 * prefixed ID for parser stability (per H.4 `parseTicketParam`).
 */
export interface SuccessScreenProps {
  readonly incident: Incident;
  readonly onReportAnother: () => void;
}

export function SuccessScreen({ incident, onReportAnother }: SuccessScreenProps) {
  const { t } = useTranslation("portal");

  return (
    <section
      className="sdm-portal-new-incident-success"
      data-testid="portal-new-incident-success"
      data-ticket-id={incident.id}
      data-ticket-ref={incident.ref}
      aria-live="polite"
    >
      <h1 className="sdm-portal-new-incident-success-title">
        {t("newIncident.success.title", { ref: incident.ref })}
      </h1>
      <p className="sdm-portal-new-incident-success-body">{t("newIncident.success.body")}</p>
      <dl className="sdm-portal-new-incident-success-meta">
        <div>
          <strong>{t("newIncident.success.status")}: </strong>
          <span>{t("newIncident.success.statusNew")}</span>
        </div>
        <div>
          <strong>{t("newIncident.success.eta")}: </strong>
          <span>{t("newIncident.success.etaValue")}</span>
        </div>
      </dl>
      <div className="sdm-portal-new-incident-success-ctas">
        <Link
          to={`/tickets/${incident.id}`}
          className="sdm-home-action-link"
          data-testid="portal-new-incident-success-view"
        >
          <Button variant="primary" type="button">
            {t("newIncident.success.viewTicket")}
          </Button>
        </Link>
        <Button
          variant="secondary"
          type="button"
          onClick={onReportAnother}
          data-testid="portal-new-incident-success-another"
        >
          {t("newIncident.success.reportAnother")}
        </Button>
        <Link
          to="/"
          className="sdm-home-action-link"
          data-testid="portal-new-incident-success-done"
        >
          <Button variant="tertiary" type="button">
            {t("newIncident.success.done")}
          </Button>
        </Link>
      </div>
    </section>
  );
}
