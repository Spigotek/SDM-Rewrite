import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import type { UiTicketType } from "@sdm/api-types";
import { Card, Skeleton, usePageTransition } from "@sdm/design-system";
import { ticketDetailQuery } from "./api";
import { AgentTicketHeader } from "./components/AgentTicketHeader";
import { ActionBar } from "./components/ActionBar";
import { ActivityTimeline } from "./components/ActivityTimeline";
import { Composer } from "./components/Composer";
import { ContextPanel } from "./components/ContextPanel";
import { EscalateModal } from "./components/EscalateModal";
import { ResolveModal } from "./components/ResolveModal";
import { useComposerTab } from "./hooks";
import { ConvertToProblemModal } from "../problems/components/ConvertToProblemModal";
import "./ticket-detail.css";

const KNOWN_TYPES: ReadonlyArray<UiTicketType> = ["incident", "request", "problem", "change"];

/**
 * Maps the route param to a `UiTicketType`. See in-tree parser comment.
 */
function parseTicketParam(raw: string): { type: UiTicketType; id: string } {
  const colon = raw.indexOf(":");
  if (colon > 0) {
    const prefix = raw.slice(0, colon);
    if ((KNOWN_TYPES as ReadonlyArray<string>).includes(prefix)) {
      return { type: prefix as UiTicketType, id: raw };
    }
  }
  return { type: "incident", id: raw };
}

/**
 * `/tickets/:id` — K.3.E redesign:
 *
 * - Card-wrapped sub-surfaces: header, body (description), activity timeline,
 *   composer. The right rail (`ContextPanel`) is a Card too.
 * - `usePageTransition` runs the K.1 crossfade on route mount.
 * - Skeleton state while the detail query is pending.
 */
export default function TicketDetailRoute() {
  const { t } = useTranslation("workspace");
  const params = useParams();
  const location = useLocation();
  const { ref: pageRef } = usePageTransition(location.pathname);
  const rawId = params["id"] ?? "";
  const { type, id } = useMemo(() => parseTicketParam(rawId), [rawId]);

  const detailQuery = useQuery({
    ...ticketDetailQuery(type, id),
    enabled: id.length > 0,
  });

  const [escalateOpen, setEscalateOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveSeed, setResolveSeed] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);
  const { setTab } = useComposerTab();

  if (detailQuery.isPending) {
    return (
      <section
        className="sdm-ticket-detail-page"
        data-testid="ticket-detail-loading"
        ref={pageRef as React.RefObject<HTMLElement>}
      >
        <div className="sdm-ticket-detail-main">
          <Card variant="surface" className="sdm-ticket-skeleton-card">
            <Skeleton variant="text" width="40%" height={22} />
            <Skeleton variant="text" width="70%" height={16} />
            <Skeleton variant="block" width="100%" height={120} />
          </Card>
          <Card variant="surface" className="sdm-ticket-skeleton-card">
            <Skeleton variant="text" width="100%" height={14} count={5} />
          </Card>
        </div>
        <aside className="sdm-ticket-context" aria-hidden="true">
          <Skeleton variant="text" width="100%" height={14} count={4} />
        </aside>
      </section>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section
        className="sdm-ticket-detail-page"
        data-testid="ticket-detail-error"
        role="alert"
        ref={pageRef as React.RefObject<HTMLElement>}
      >
        <p className="sdm-ticket-state sdm-ticket-state--error">{t("ticketDetail.error")}</p>
      </section>
    );
  }

  const detail = detailQuery.data;

  const onResolveFromComposer = (draft: string) => {
    setResolveSeed(draft);
    setResolveOpen(true);
  };

  const onReplyClick = () => {
    setTab("public");
    // Move focus to the textarea on the next paint.
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="ticket-composer-textarea"]',
      );
      el?.focus();
    });
  };

  return (
    <section
      className="sdm-ticket-detail-page"
      data-testid="ticket-detail-page"
      data-ticket-type={detail.ticketType}
      data-ticket-id={detail.id}
      ref={pageRef as React.RefObject<HTMLElement>}
    >
      <div className="sdm-ticket-detail-main">
        <Card variant="surface" className="sdm-ticket-detail-section-card">
          <AgentTicketHeader detail={detail} />
        </Card>
        <ActionBar
          detail={detail}
          onResolveClick={() => {
            setResolveSeed("");
            setResolveOpen(true);
          }}
          onEscalateClick={() => setEscalateOpen(true)}
          onReplyClick={onReplyClick}
          onConvertToProblemClick={
            detail.ticketType === "incident" ? () => setConvertOpen(true) : undefined
          }
        />
        {detail.description ? (
          <Card variant="surface" className="sdm-ticket-detail-section-card">
            <section className="sdm-ticket-section" data-testid="ticket-description">
              <h2 className="sdm-ticket-section-title">{t("ticketDetail.sections.description")}</h2>
              <p className="sdm-ticket-section-body">{detail.description}</p>
            </section>
          </Card>
        ) : null}
        <Card variant="surface" className="sdm-ticket-detail-section-card">
          <ActivityTimeline activity={detail.activity} />
        </Card>
        <Card variant="surface" className="sdm-ticket-detail-section-card">
          <Composer detail={detail} onResolveRequest={onResolveFromComposer} />
        </Card>
      </div>

      <ContextPanel detail={detail} />

      {escalateOpen && <EscalateModal detail={detail} onClose={() => setEscalateOpen(false)} />}
      {resolveOpen && (
        <ResolveModal
          detail={detail}
          initialSolution={resolveSeed}
          onClose={() => setResolveOpen(false)}
        />
      )}
      {convertOpen && (
        <ConvertToProblemModal
          incidentId={detail.id}
          initialSummary={detail.summary}
          onClose={() => setConvertOpen(false)}
        />
      )}
    </section>
  );
}
