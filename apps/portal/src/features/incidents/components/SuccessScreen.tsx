import { Link } from "react-router-dom";
import { Button, EmptyState, IllustrationNoOpenTickets } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import type { Incident } from "@sdm/domain";

/**
 * `SuccessScreen` — v1.2 redesign (K.3.E).
 *
 * Hero `EmptyState` (illustration + title + body), then a large tabular-nums
 * ticket-ref display, a short meta strip (status, ETA), and three CTAs.
 *
 * The `IllustrationNoOpenTickets` glyph is re-used here as a friendly inbox
 * motif — the brief's prompt explicitly nominates it as the success placeholder.
 *
 * Three CTAs (order = importance for the requester journey):
 *   1. **Vrátiť sa na domov** (primary) — back to `/`, the landing dashboard.
 *   2. **Nahlásiť ďalší** (secondary) — clears the local incident state and
 *      remounts the form via a `key` change.
 *   3. **View ticket** (link / tertiary button) — opens the H.4 detail page so
 *      Lucia can immediately see the helpdesk-visible state.
 *
 * The success `ref` is rendered prominently — `font-variant-numeric: tabular-nums`
 * keeps the digits aligned.
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
      <EmptyState
        variant="hero"
        illustration={<IllustrationNoOpenTickets />}
        title={t("newIncident.success.title")}
        description={t("newIncident.success.body")}
      />
      <p
        className="sdm-portal-new-incident-success-ref"
        data-testid="portal-new-incident-success-ref"
        aria-label={`${t("newIncident.success.refLabel")}: ${incident.ref}`}
      >
        <span aria-hidden="true">#</span>
        <span aria-hidden="true">{incident.ref}</span>
      </p>
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
          to="/"
          className="sdm-home-action-link"
          data-testid="portal-new-incident-success-done"
        >
          <Button variant="primary" type="button" fullWidth>
            {t("newIncident.success.done")}
          </Button>
        </Link>
        <Button
          variant="secondary"
          type="button"
          onClick={onReportAnother}
          data-testid="portal-new-incident-success-another"
          fullWidth
        >
          {t("newIncident.success.reportAnother")}
        </Button>
        <Link
          to={`/tickets/${incident.id}`}
          className="sdm-home-action-link"
          data-testid="portal-new-incident-success-view"
        >
          <Button variant="tertiary" type="button" fullWidth>
            {t("newIncident.success.viewTicket")}
          </Button>
        </Link>
      </div>
    </section>
  );
}
