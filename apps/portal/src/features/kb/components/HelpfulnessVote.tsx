import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, TextArea } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { postHelpfulness, type HelpfulnessResult } from "../api";
import type { HelpfulnessVote as Vote } from "../types";

/**
 * Helpfulness widget — `👍 / 👎` + optional comment textarea.
 *
 * Round-trip:
 *   1. Click `👍` → submit immediately, state flips to "thanks".
 *   2. Click `👎` → reveal comment textarea, submit with comment.
 *
 * The `data-helpfulness-vote` attribute on the wrapper carries the
 * recorded vote so the browser test can assert the submit landed
 * without poking at internal mutation state.
 */
export function HelpfulnessVote({ articleId }: { articleId: string }) {
  const { t } = useTranslation("portal");
  const [stage, setStage] = useState<"idle" | "askComment" | "done">("idle");
  const [recordedVote, setRecordedVote] = useState<Vote | null>(null);
  const [comment, setComment] = useState("");

  const mutation = useMutation<HelpfulnessResult, Error, { vote: Vote; comment?: string }>({
    mutationFn: ({ vote, comment: c }) =>
      postHelpfulness(articleId, c ? { vote, comment: c } : { vote }),
    onSuccess: (_data, variables) => {
      setRecordedVote(variables.vote);
      setStage("done");
    },
  });

  function onUp(): void {
    mutation.mutate({ vote: "up" });
  }

  function onDown(): void {
    setStage("askComment");
  }

  function onSubmitDown(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = comment.trim();
    mutation.mutate({ vote: "down", ...(trimmed ? { comment: trimmed } : {}) });
  }

  if (stage === "done" && recordedVote) {
    return (
      <section
        className="sdm-kb-helpfulness sdm-kb-helpfulness--done"
        data-testid="kb-helpfulness"
        data-helpfulness-vote={recordedVote}
        aria-live="polite"
      >
        <p>{t(`kb.helpfulness.thanks.${recordedVote}`)}</p>
      </section>
    );
  }

  return (
    <section className="sdm-kb-helpfulness" data-testid="kb-helpfulness">
      <h2 className="sdm-kb-helpfulness-title">{t("kb.helpfulness.prompt")}</h2>
      <div className="sdm-kb-helpfulness-actions">
        <Button
          variant="secondary"
          type="button"
          onClick={onUp}
          disabled={mutation.isPending}
          aria-pressed={false}
          data-testid="kb-helpfulness-up"
        >
          {t("kb.helpfulness.yes")}
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={onDown}
          disabled={mutation.isPending}
          aria-pressed={stage === "askComment"}
          data-testid="kb-helpfulness-down"
        >
          {t("kb.helpfulness.no")}
        </Button>
      </div>

      {stage === "askComment" ? (
        <form className="sdm-kb-helpfulness-comment" onSubmit={onSubmitDown}>
          <TextArea
            label={t("kb.helpfulness.commentLabel")}
            placeholder={t("kb.helpfulness.commentPlaceholder")}
            value={comment}
            rows={3}
            data-testid="kb-helpfulness-comment"
            onChange={(event) => setComment(event.currentTarget.value)}
          />
          <div className="sdm-kb-helpfulness-comment-actions">
            <Button
              variant="primary"
              type="submit"
              loading={mutation.isPending}
              data-testid="kb-helpfulness-submit"
            >
              {t("kb.helpfulness.submit")}
            </Button>
          </div>
          {mutation.isError ? (
            <p role="alert" className="sdm-kb-helpfulness-error">
              {t("kb.helpfulness.error")}
            </p>
          ) : null}
        </form>
      ) : null}

      {mutation.isError && stage !== "askComment" ? (
        <p role="alert" className="sdm-kb-helpfulness-error">
          {t("kb.helpfulness.error")}
        </p>
      ) : null}
    </section>
  );
}
