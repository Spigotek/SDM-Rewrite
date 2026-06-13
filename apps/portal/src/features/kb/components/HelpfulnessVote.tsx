import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, IconButton, TextArea } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { postHelpfulness, type HelpfulnessResult } from "../api";
import type { HelpfulnessVote as Vote } from "../types";

/**
 * Helpfulness widget — thumbs-up / thumbs-down `<IconButton>` pair with
 * inline tallies (K.3.E v1.2). Comment textarea is revealed after a
 * down-vote, mirroring the v1.1.4 flow.
 *
 * Round-trip:
 *   1. Click thumbs-up   → submit immediately, "done" state.
 *   2. Click thumbs-down → reveal comment textarea, submit with comment.
 *
 * Test-ids `kb-helpfulness`, `kb-helpfulness-up`, `kb-helpfulness-down`,
 * `kb-helpfulness-submit`, `kb-helpfulness-comment` are preserved
 * (journey-03 acceptance). The wrapper `data-helpfulness-vote` carries
 * the recorded vote so e2e checks don't have to inspect mutation state.
 *
 * Lucide-styled inline SVG glyphs — the portal has no `lucide-react` dep
 * (follows the K.2 top-bar / `KbSearchBar.tsx` convention).
 */
function ThumbsUpIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10a4 4 0 0 0 .27-.62L11 3a1.7 1.7 0 0 1 3 0c.85 1.46 1 3.34 1 4.88Z" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12a4 4 0 0 0-.27.62L13 21a1.7 1.7 0 0 1-3 0c-.85-1.46-1-3.34-1-4.88Z" />
    </svg>
  );
}

export interface HelpfulnessVoteProps {
  readonly articleId: string;
  /** Server-reported helpful count; displayed next to the thumbs-up button. */
  readonly helpfulCount: number;
}

export function HelpfulnessVote({ articleId, helpfulCount }: HelpfulnessVoteProps) {
  const { t } = useTranslation("portal");
  const [stage, setStage] = useState<"idle" | "askComment" | "done">("idle");
  const [recordedVote, setRecordedVote] = useState<Vote | null>(null);
  const [comment, setComment] = useState("");
  const [optimisticUp, setOptimisticUp] = useState(helpfulCount);
  const [optimisticDown, setOptimisticDown] = useState(0);

  const mutation = useMutation<HelpfulnessResult, Error, { vote: Vote; comment?: string }>({
    mutationFn: ({ vote, comment: c }) =>
      postHelpfulness(articleId, c ? { vote, comment: c } : { vote }),
    onSuccess: (data, variables) => {
      setRecordedVote(variables.vote);
      setStage("done");
      if (data?.tally) {
        setOptimisticUp(data.tally.up);
        setOptimisticDown(data.tally.down);
      }
    },
  });

  function onUp(): void {
    setOptimisticUp((n) => n + 1);
    mutation.mutate({ vote: "up" });
  }

  function onDown(): void {
    setStage("askComment");
  }

  function onSubmitDown(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = comment.trim();
    setOptimisticDown((n) => n + 1);
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
        <span className="sdm-kb-helpfulness-vote">
          <IconButton
            aria-label={t("kb.helpfulness.yes")}
            icon={<ThumbsUpIcon />}
            variant="outline"
            size="md"
            onClick={onUp}
            disabled={mutation.isPending}
            data-testid="kb-helpfulness-up"
          />
          <span className="sdm-kb-helpfulness-count" data-testid="kb-helpfulness-up-count">
            {optimisticUp}
          </span>
        </span>
        <span className="sdm-kb-helpfulness-vote">
          <IconButton
            aria-label={t("kb.helpfulness.no")}
            icon={<ThumbsDownIcon />}
            variant="outline"
            size="md"
            onClick={onDown}
            aria-pressed={stage === "askComment"}
            disabled={mutation.isPending}
            data-testid="kb-helpfulness-down"
          />
          <span className="sdm-kb-helpfulness-count" data-testid="kb-helpfulness-down-count">
            {optimisticDown}
          </span>
        </span>
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
