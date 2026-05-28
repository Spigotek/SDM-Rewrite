import { useTranslation } from "@sdm/i18n";

/**
 * Description block.
 *
 * Description ships as plain text — the spec describes the field as plain
 * (no Markdown) and we deliberately avoid pulling in `react-markdown` +
 * `remark-gfm` + `rehype-sanitize` (~70 KB gzip) for a feature that doesn't
 * need it. KB articles (H.6) keep that budget; the ticket body stays cheap.
 *
 * `white-space: pre-wrap` preserves user line breaks. URLs are not auto-
 * linkified — that's a future enhancement gated on Markdown support.
 */
export interface TicketBodyProps {
  readonly description: string;
}

export function TicketBody({ description }: TicketBodyProps) {
  const { t } = useTranslation("portal");
  if (!description.trim()) {
    return (
      <section className="sdm-portal-ticket-body" data-testid="portal-ticket-body-empty">
        <p className="sdm-portal-ticket-body-empty">{t("ticketDetail.body.empty")}</p>
      </section>
    );
  }
  return (
    <section className="sdm-portal-ticket-body" data-testid="portal-ticket-body">
      <p className="sdm-portal-ticket-body-text">{description}</p>
    </section>
  );
}
