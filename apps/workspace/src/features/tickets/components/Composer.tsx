import { useCallback, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button, TextArea } from "@sdm/design-system";
import type { UiTicketDetail } from "@sdm/api-types";
import { useComposerDraft, useComposerTab, usePostComment } from "../hooks";
import type { ComposerTab } from "../types";

const TABS: ReadonlyArray<ComposerTab> = ["public", "internal", "resolution"];

export interface ComposerProps {
  readonly detail: UiTicketDetail;
  readonly onResolveRequest: (draft: string) => void;
}

/**
 * Composer — 3 tabs (Public reply / Internal note / Resolution).
 *
 * Public + Internal both POST a comment with the respective `kind`. The
 * Resolution tab is a *handoff* — submit forwards the current draft to the
 * parent which opens `ResolveModal` and lets the agent pick a category before
 * the BFF round-trip closes the ticket.
 *
 * Plain `<TextArea>` per H.8 §Open questions — TipTap is deferred to a v1+
 * iteration to avoid a ~70 KB lazy chunk in the workspace baseline. Markdown
 * shorthand (`**bold**`, lists) is rendered by the timeline lazily; the
 * composer itself ships plain.
 */
export function Composer({ detail, onResolveRequest }: ComposerProps) {
  const { t } = useTranslation("workspace");
  const { tab, setTab } = useComposerTab();
  const draft = useComposerDraft(detail.ticketType, detail.id, tab);
  const post = usePostComment(detail.ticketType, detail.id);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const submit = useCallback(() => {
    const value = draft.value.trim();
    if (!value) return;
    if (tab === "resolution") {
      onResolveRequest(value);
      return;
    }
    const kind: "public" | "internal" = tab === "internal" ? "internal" : "public";
    post.mutate(
      { text: value, kind },
      {
        onSuccess: () => draft.clear(),
      },
    );
  }, [draft, onResolveRequest, post, tab]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const placeholder = t(`ticketDetail.composer.placeholder.${tab}`);
  const submitLabel =
    tab === "resolution"
      ? t("ticketDetail.composer.submit.resolution")
      : t("ticketDetail.composer.submit.send");

  return (
    <section
      className="sdm-ticket-composer"
      aria-label={t("ticketDetail.composer.ariaLabel")}
      data-testid="ticket-composer"
    >
      <div className="sdm-ticket-composer-tabs" role="tablist">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="sdm-ticket-composer-tab"
            data-active={tab === id || undefined}
            data-testid={`ticket-composer-tab-${id}`}
            onClick={() => setTab(id)}
          >
            {t(`ticketDetail.composer.tab.${id}`)}
          </button>
        ))}
      </div>

      <div className="sdm-ticket-composer-body">
        <TextArea
          ref={ref}
          label={t(`ticketDetail.composer.tab.${tab}`)}
          srOnlyLabel
          placeholder={placeholder}
          value={draft.value}
          onChange={(e) => draft.setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={5}
          data-testid="ticket-composer-textarea"
        />
        <div className="sdm-ticket-composer-footer">
          <span className="sdm-ticket-composer-hint">
            {t("ticketDetail.composer.cmdEnterHint")}
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={draft.value.trim().length === 0}
            loading={post.isPending}
            data-testid="ticket-composer-submit"
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
