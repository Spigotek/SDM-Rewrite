import { useTranslation } from "@sdm/i18n";
import { Link } from "react-router-dom";
import type { UiTicketDetail } from "@sdm/api-types";

export interface ContextPanelProps {
  readonly detail: UiTicketDetail;
}

/**
 * Right context rail. Three blocks:
 *  - Requester card — pulled from the parent's `customer` FkRef.
 *  - CI card — H.8 ships the affected-CI hook as a placeholder (the F.6
 *    aggregator does not surface the `affected_resource` lookup yet; CMDB
 *    detail is owned by H.11 + H.13).
 *  - Related records — backed by `detail.linked`. When the BFF reports
 *    `_unsupported: true` (real CA SDM lacks the BREL relation) we render
 *    an empty state instead of an HTTP-error blob.
 *
 * Each block keeps its own `<section aria-label>` so screen readers can jump
 * directly between requester / CI / linked records.
 */
export function ContextPanel({ detail }: ContextPanelProps) {
  const { t } = useTranslation("workspace");
  const linkedUnsupported = detail.linked._unsupported;
  const totalLinked =
    detail.linked.problems.length + detail.linked.changes.length + detail.linked.incidents.length;

  return (
    <aside
      className="sdm-ticket-context"
      aria-label={t("ticketDetail.context.ariaLabel")}
      data-testid="ticket-context-panel"
    >
      <section
        className="sdm-ticket-context-block"
        aria-label={t("ticketDetail.context.requester")}
      >
        <h2 className="sdm-ticket-context-heading">{t("ticketDetail.context.requester")}</h2>
        {detail.customer ? (
          <dl className="sdm-ticket-context-dl" data-testid="ticket-context-requester">
            <dt>{t("ticketDetail.context.fields.name")}</dt>
            <dd>{detail.customer.label}</dd>
            <dt>{t("ticketDetail.context.fields.id")}</dt>
            <dd>{detail.customer.code}</dd>
          </dl>
        ) : (
          <p className="sdm-ticket-context-empty">{t("ticketDetail.context.noRequester")}</p>
        )}
      </section>

      <section className="sdm-ticket-context-block" aria-label={t("ticketDetail.context.ci")}>
        <h2 className="sdm-ticket-context-heading">{t("ticketDetail.context.ci")}</h2>
        <p className="sdm-ticket-context-empty" data-testid="ticket-context-ci">
          {t("ticketDetail.context.ciPlaceholder")}
        </p>
      </section>

      <section className="sdm-ticket-context-block" aria-label={t("ticketDetail.context.related")}>
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
      </section>
    </aside>
  );
}
