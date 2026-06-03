import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type { KbVisibility } from "../types";
import { VisibilitySelector } from "./VisibilitySelector";

/**
 * Publish confirmation modal. Mirrors `ApproveModal.tsx` (H.11) — same
 * overlay + dialog pattern with `aria-modal`, ESC-to-close, autofocus on
 * cancel, and a primary "Publish" CTA. Visibility + tag list are last-mile
 * fields that the agent confirms before the publish mutation fires.
 */
export interface PublishModalProps {
  readonly title: string;
  readonly defaultVisibility: KbVisibility;
  readonly defaultTags: readonly string[];
  readonly busy: boolean;
  readonly onConfirm: (input: { visibility: KbVisibility; tags: readonly string[] }) => void;
  readonly onCancel: () => void;
}

export function PublishModal({
  title,
  defaultVisibility,
  defaultTags,
  busy,
  onConfirm,
  onCancel,
}: PublishModalProps) {
  const { t } = useTranslation("workspace");
  const [visibility, setVisibility] = useState<KbVisibility>(defaultVisibility);
  const [tagsRaw, setTagsRaw] = useState<string>(defaultTags.join(", "));
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    cancelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = () => {
    const tags = tagsRaw
      .split(",")
      .map((t_) => t_.trim())
      .filter((t_) => t_.length > 0);
    onConfirm({ visibility, tags });
  };

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kb-publish-modal-title"
        className="sdm-modal-dialog"
        data-testid="kb-publish-modal"
      >
        <h2 id="kb-publish-modal-title" className="sdm-modal-title">
          {t("kb.editor.publishModal.title", { title })}
        </h2>
        <p className="sdm-modal-body">{t("kb.editor.publishModal.body")}</p>

        <VisibilitySelector value={visibility} onChange={setVisibility} disabled={busy} />

        <label className="sdm-kb-editor-tags-label">
          <span>{t("kb.editor.publishModal.tagsLabel")}</span>
          <input
            type="text"
            data-testid="kb-publish-tags"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder={t("kb.editor.publishModal.tagsPlaceholder")}
            disabled={busy}
          />
        </label>

        <div className="sdm-modal-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            data-testid="kb-publish-cancel"
            disabled={busy}
          >
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} data-testid="kb-publish-submit">
            {t("kb.editor.publishModal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
