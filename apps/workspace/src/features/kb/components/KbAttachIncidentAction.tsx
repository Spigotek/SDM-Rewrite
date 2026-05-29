import { Link, useSearchParams } from "react-router-dom";
import { Card } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";

/**
 * Cross-feature CTA — when an agent reaches the KB article via
 * `?attachToTicket=INC-X` (e.g. from `/tickets/:id` context panel), surface a
 * pinned action that hops back to the originating ticket with this article id
 * pre-attached. The actual attach payload is owned by the ticket detail
 * (`/tickets/:id?attachKbArticle=<id>`); H.15 only emits the navigation
 * intent, no audit event from the KB side (F.4 audit taxonomy frozen).
 *
 * When `?attachToTicket` is absent the CTA renders nothing — the article view
 * stays a clean read surface.
 */
export interface KbAttachIncidentActionProps {
  readonly articleId: string;
}

export function KbAttachIncidentAction({ articleId }: KbAttachIncidentActionProps) {
  const { t } = useTranslation("workspace");
  const [params] = useSearchParams();
  const ticketRef = params.get("attachToTicket");
  if (!ticketRef) return null;

  const target = `/tickets/${encodeURIComponent(ticketRef)}?attachKbArticle=${encodeURIComponent(
    articleId,
  )}`;
  return (
    <Card variant="interactive" className="sdm-kb-attach-card">
      <div
        className="sdm-kb-attach-content"
        data-testid="kb-attach-incident-action"
        data-ticket-ref={ticketRef}
      >
        <p className="sdm-kb-attach-title">{t("kb.attach.title", { ticket: ticketRef })}</p>
        <p className="sdm-kb-attach-hint">{t("kb.attach.hint")}</p>
        <Link to={target} className="sdm-kb-attach-cta" data-testid="kb-attach-incident-cta">
          {t("kb.attach.cta", { ticket: ticketRef })}
        </Link>
      </div>
    </Card>
  );
}
