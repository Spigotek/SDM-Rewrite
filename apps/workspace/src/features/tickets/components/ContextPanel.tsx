import { useTranslation } from "@sdm/i18n";
import { Link } from "react-router-dom";
import { Avatar, Card } from "@sdm/design-system";
import type { UiTicketDetail } from "@sdm/api-types";

export interface ContextPanelProps {
  readonly detail: UiTicketDetail;
}

/**
 * Right context rail — K.3.E polish.
 *
 * Each block is now a `<Card variant="subtle">` so the right rail picks up
 * surface/border tokens from the design-system instead of bespoke
 * `border-left` markers, and dark/light theming flows for free.
 *
 * Blocks:
 *  - Requester (with Avatar)
 *  - CI placeholder (H.11 attaches the real CMDB linkage)
 *  - Related records — Problems + Changes + Incidents
 *  - Watchers (M.x placeholder per K.3.E checklist)
 */
export function ContextPanel({ detail }: ContextPanelProps) {
  const { t } = useTranslation("workspace");
  const linkedUnsupported = detail.linked._unsupported;
  const totalLinked =
    detail.linked.problems.length + detail.linked.changes.length + detail.linked.incidents.length;
  const customerName = detail.customer?.label ?? t("ticketDetail.context.noRequester");

  return (
    <aside
      className="sdm-ticket-context"
      aria-label={t("ticketDetail.context.ariaLabel")}
      data-testid="ticket-context-panel"
    >
      <Card variant="subtle" className="sdm-ticket-context-block">
        <h2 className="sdm-ticket-context-heading">{t("ticketDetail.context.requester")}</h2>
        {detail.customer ? (
          <div className="sdm-ticket-context-requester" data-testid="ticket-context-requester">
            <Avatar name={customerName} size="md" />
            <dl className="sdm-ticket-context-dl">
              <dt>{t("ticketDetail.context.fields.name")}</dt>
              <dd>{detail.customer.label}</dd>
              <dt>{t("ticketDetail.context.fields.id")}</dt>
              <dd className="sdm-tabular">{detail.customer.code}</dd>
            </dl>
          </div>
        ) : (
          <p className="sdm-ticket-context-empty">{t("ticketDetail.context.noRequester")}</p>
        )}
      </Card>

      <Card variant="subtle" className="sdm-ticket-context-block">
        <h2 className="sdm-ticket-context-heading">{t("ticketDetail.context.ci")}</h2>
        <p className="sdm-ticket-context-empty" data-testid="ticket-context-ci">
          {t("ticketDetail.context.ciPlaceholder")}
        </p>
      </Card>

      <Card variant="subtle" className="sdm-ticket-context-block">
        <h2 className="sdm-ticket-context-heading">{t("ticketDetail.context.related")}</h2>
        {linkedUnsupported ? (
          <p className="sdm-ticket-context-empty" data-testid="ticket-context-related-unsupported">
            {t("ticketDetail.context.relatedUnsupported")}
          </p>
        ) : totalLinked === 0 ? (
          <p className="sdm-ticket-context-empty" data-testid="ticket-context-related-empty">
            {t("ticketDetail.context.relatedEmpty")}
          </p>
        ) : (
          <ul className="sdm-ticket-context-related" data-testid="ticket-context-related">
            {detail.linked.problems.map((p) => (
              <li key={`p-${p.id}`}>
                <Link to={`/problems/${p.id}`}>
                  <span className="sdm-ticket-context-related-type">PRB</span> {p.label}
                </Link>
              </li>
            ))}
            {detail.linked.changes.map((c) => (
              <li key={`c-${c.id}`}>
                <Link to={`/changes/${c.id}`}>
                  <span className="sdm-ticket-context-related-type">CHG</span> {c.label}
                </Link>
              </li>
            ))}
            {detail.linked.incidents.map((i) => (
              <li key={`i-${i.id}`}>
                <Link to={`/tickets/${i.id}`}>
                  <span className="sdm-ticket-context-related-type">INC</span> {i.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card variant="subtle" className="sdm-ticket-context-block">
        <h2 className="sdm-ticket-context-heading">{t("ticketDetail.sections.watchers")}</h2>
        <p className="sdm-ticket-context-empty" data-testid="ticket-context-watchers">
          {t("ticketDetail.sections.watchersEmpty")}
        </p>
      </Card>
    </aside>
  );
}
