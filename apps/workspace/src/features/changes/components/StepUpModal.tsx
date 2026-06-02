import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button, TextField } from "@sdm/design-system";

/**
 * I.1 step-up 2FA modal.
 *
 * Renders a 6-digit TOTP input; submits to `POST /auth/step-up`; on 200,
 * surfaces the minted token to the caller via `onSuccess(token)`. Used as a
 * pre-step in `ApproveModal` when the active change is EMERGENCY in a
 * production tenant — defense-in-depth alongside the BFF's `X-Step-Up-Token`
 * gate (`apps/bff/src/api/endpoints/changes.ts`).
 *
 * Built from scratch (not via `<ConfirmDialog>`) because the flow is
 * purpose-specific: a single TOTP input, no destructive-verb framing, and
 * an explicit "Verify" submit verb in the i18n catalog. Reuses the same
 * `sdm-modal-*` CSS surface as `ApproveModal` so visual consistency holds.
 */

export interface StepUpModalProps {
  readonly onSuccess: (token: string) => void;
  readonly onCancel: () => void;
}

interface StepUpResponse {
  readonly stepUpToken: string;
  readonly expiresAt: string;
}

async function postStepUp(totp: string): Promise<StepUpResponse> {
  const resp = await fetch("/auth/step-up", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ totp }),
  });
  if (!resp.ok) {
    throw new Error(String(resp.status));
  }
  return (await resp.json()) as StepUpResponse;
}

export function StepUpModal({ onSuccess, onCancel }: StepUpModalProps) {
  const { t } = useTranslation("workspace");
  const [totp, setTotp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const canSubmit = /^\d{6}$/.test(totp) && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await postStepUp(totp);
      onSuccess(result.stepUpToken);
    } catch (err) {
      const status = err instanceof Error ? Number(err.message) : 0;
      if (status === 401) setError(t("stepUp.errors.invalidCode"));
      else if (status === 0) setError(t("stepUp.errors.networkError"));
      else setError(t("stepUp.errors.networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-up-modal-title"
        aria-describedby="step-up-modal-help"
        className="sdm-modal-dialog"
        data-testid="step-up-modal"
      >
        <h2 id="step-up-modal-title" className="sdm-modal-title">
          {t("stepUp.title")}
        </h2>
        <p id="step-up-modal-help" className="sdm-modal-body">
          {t("stepUp.help")}
        </p>

        <TextField
          ref={inputRef}
          label={t("stepUp.label")}
          value={totp}
          onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          required
          {...(error ? { error } : {})}
          data-testid="step-up-totp"
        />

        <div className="sdm-modal-actions">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
            data-testid="step-up-cancel"
          >
            {t("stepUp.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void onSubmit()}
            loading={submitting}
            disabled={!canSubmit}
            data-testid="step-up-submit"
          >
            {t("stepUp.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
