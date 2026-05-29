import { useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type { UiTicketDetail } from "@sdm/api-types";
import { useTake, useWatch } from "../hooks";

export interface ActionBarProps {
  readonly detail: UiTicketDetail;
  readonly onResolveClick: () => void;
  readonly onEscalateClick: () => void;
  readonly onReplyClick: () => void;
  readonly onConvertToProblemClick?: (() => void) | undefined;
}

/**
 * Action bar — the transition strip below the header. Each button maps to a
 * mutation hook. `Resolve` and `Escalate` open modals because they require a
 * payload (Solution / Note + Group); `Take` and `Watch` fire-and-forget.
 *
 * The "More" menu hosts secondary actions: copy link, mark-KB-candidate
 * (deferred), and — added in H.12 — "Convert to problem" for incident
 * tickets (opens the convert modal so Marek can spin up a problem record
 * seeded from the symptoms Anna has been triaging).
 */
export function ActionBar({
  detail,
  onResolveClick,
  onEscalateClick,
  onReplyClick,
  onConvertToProblemClick,
}: ActionBarProps) {
  const { t } = useTranslation("workspace");
  const take = useTake(detail.ticketType, detail.id);
  const watch = useWatch(detail.ticketType, detail.id);
  const [moreOpen, setMoreOpen] = useState(false);

  const copyLink = () => {
    if (typeof window === "undefined") return;
    void navigator.clipboard?.writeText(window.location.href);
    setMoreOpen(false);
  };

  return (
    <div className="sdm-ticket-actionbar" data-testid="ticket-actionbar">
      <Button
        variant="secondary"
        size="sm"
        onClick={onReplyClick}
        data-testid="ticket-action-reply"
      >
        {t("ticketDetail.actions.reply")}
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => take.mutate()}
        loading={take.isPending}
        data-testid="ticket-action-take"
      >
        {t("ticketDetail.actions.take")}
      </Button>
      <Button
        variant="success"
        size="sm"
        onClick={onResolveClick}
        data-testid="ticket-action-resolve"
      >
        {t("ticketDetail.actions.resolve")}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={onEscalateClick}
        data-testid="ticket-action-escalate"
      >
        {t("ticketDetail.actions.escalate")}
      </Button>
      <Button
        variant="tertiary"
        size="sm"
        onClick={() => watch.mutate()}
        loading={watch.isPending}
        data-testid="ticket-action-watch"
      >
        {t("ticketDetail.actions.watch")}
      </Button>
      <div className="sdm-ticket-actionbar-more">
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => setMoreOpen((v) => !v)}
          data-testid="ticket-action-more"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
        >
          {t("ticketDetail.actions.more")}
        </Button>
        {moreOpen && (
          <ul className="sdm-ticket-actionbar-menu" role="menu">
            <li role="menuitem">
              <button type="button" onClick={copyLink} data-testid="ticket-action-copy-link">
                {t("ticketDetail.actions.copyLink")}
              </button>
            </li>
            {detail.ticketType === "incident" && onConvertToProblemClick ? (
              <li role="menuitem">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onConvertToProblemClick();
                  }}
                  data-testid="ticket-action-convert-to-problem"
                >
                  {t("problems.actions.convert")}
                </button>
              </li>
            ) : null}
            <li role="menuitem">
              <button type="button" onClick={() => setMoreOpen(false)} disabled>
                {t("ticketDetail.actions.markKbCandidate")}
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
