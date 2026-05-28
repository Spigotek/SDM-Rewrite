import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import type { UiTicketType } from "@sdm/api-types";
import { ticketDetailQuery } from "./api";
import { AgentTicketHeader } from "./components/AgentTicketHeader";
import { ActionBar } from "./components/ActionBar";
import { ActivityTimeline } from "./components/ActivityTimeline";
import { Composer } from "./components/Composer";
import { ContextPanel } from "./components/ContextPanel";
import { EscalateModal } from "./components/EscalateModal";
import { ResolveModal } from "./components/ResolveModal";
import { useComposerTab } from "./hooks";
import "./ticket-detail.css";

const KNOWN_TYPES: ReadonlyArray<UiTicketType> = ["incident", "request", "problem", "change"];

/**
 * Maps the route param to a `UiTicketType`. The H.7 split-pane stores the
 * full prefixed ID (`incident:10001`) — the prefix is also the type segment
 * the BFF expects. We accept both `incident:…` and the raw `IN-…` ref by
 * sniffing the ID format:
 *  - `incident:…` / `request:…` / `problem:…` / `change:…` → split.
 *  - Bare ID without prefix → default to `incident` (the H.7 queue table only
 *    surfaces incident/request/problem; problem and request rows already use
 *    their typed ID format).
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

export default function TicketDetailRoute() {
  const { t } = useTranslation("workspace");
  const params = useParams();
  const rawId = params["id"] ?? "";
  const { type, id } = useMemo(() => parseTicketParam(rawId), [rawId]);

  const detailQuery = useQuery({
    ...ticketDetailQuery(type, id),
    enabled: id.length > 0,
  });

  const [escalateOpen, setEscalateOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveSeed, setResolveSeed] = useState("");
  const { setTab } = useComposerTab();

  if (detailQuery.isPending) {
    return (
      <section className="sdm-ticket-detail-page" data-testid="ticket-detail-loading">
        <p className="sdm-ticket-state">{t("ticketDetail.loading")}</p>
      </section>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="sdm-ticket-detail-page" data-testid="ticket-detail-error" role="alert">
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
    >
      <div className="sdm-ticket-detail-main">
        <AgentTicketHeader detail={detail} />
        <ActionBar
          detail={detail}
          onResolveClick={() => {
            setResolveSeed("");
            setResolveOpen(true);
          }}
          onEscalateClick={() => setEscalateOpen(true)}
          onReplyClick={onReplyClick}
        />
        <ActivityTimeline activity={detail.activity} />
        <Composer detail={detail} onResolveRequest={onResolveFromComposer} />
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
    </section>
  );
}
