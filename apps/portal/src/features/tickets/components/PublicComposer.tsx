import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button, TextArea } from "@sdm/design-system";
import { usePostPublicComment } from "../hooks";
import type { PortalTicketType } from "../types";

/**
 * Single-tab Composer — public reply only.
 *
 * The requester persona has no internal-note or resolution surface; the
 * workspace Composer's three-tab UX is intentionally collapsed to one
 * Send button. Cmd/Ctrl+Enter submits.
 *
 * Drafts do **not** persist in localStorage on the portal (vs the workspace
 * three-tab Composer which does). Lucia's expected interaction is a quick
 * "thanks" / "still broken" reply — preserving state across navigation
 * would add a localStorage key without a clear win.
 */
export interface PublicComposerProps {
  readonly ticketType: PortalTicketType;
  readonly ticketId: string;
  readonly closed: boolean;
}

export function PublicComposer({ ticketType, ticketId, closed }: PublicComposerProps) {
  const { t } = useTranslation("portal");
  const [draft, setDraft] = useState("");
  const post = usePostPublicComment(ticketType, ticketId);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    post.mutate(text, {
      onSuccess: () => {
        setDraft("");
        // Re-focus so chained replies are fluent.
        requestAnimationFrame(() => textareaRef.current?.focus());
      },
    });
  }, [draft, post]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  if (closed) {
    return (
      <section
        className="sdm-portal-ticket-composer sdm-portal-ticket-composer--closed"
        data-testid="portal-ticket-composer-closed"
      >
        <p className="sdm-portal-ticket-composer-closed-hint">
          {t("ticketDetail.composer.closedHint")}
        </p>
      </section>
    );
  }

  return (
    <section
      className="sdm-portal-ticket-composer"
      aria-label={t("ticketDetail.composer.ariaLabel")}
      data-testid="portal-ticket-composer"
    >
      <h2 className="sdm-portal-ticket-section-title">{t("ticketDetail.composer.title")}</h2>
      <TextArea
        ref={textareaRef}
        label={t("ticketDetail.composer.label")}
        srOnlyLabel
        placeholder={t("ticketDetail.composer.placeholder")}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        rows={4}
        data-testid="portal-ticket-composer-textarea"
      />
      {post.isError ? (
        <p
          role="alert"
          className="sdm-portal-ticket-composer-error"
          data-testid="portal-ticket-composer-error"
        >
          {t("ticketDetail.composer.error")}
        </p>
      ) : null}
      <div className="sdm-portal-ticket-composer-footer">
        <span className="sdm-portal-ticket-composer-hint">
          {t("ticketDetail.composer.cmdEnterHint")}
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={draft.trim().length === 0}
          loading={post.isPending}
          data-testid="portal-ticket-composer-submit"
        >
          {t("ticketDetail.composer.submit")}
        </Button>
      </div>
    </section>
  );
}
