import { useTranslation } from "@sdm/i18n";
import type { KbVisibility } from "../types";

/**
 * Visibility scope radio group — `public` / `tenant` (default) / `sp_only`.
 *
 * Per `wireframes/workspace/04-kb-editor.md §Visibility`:
 *   - `public`   anonymous portal read (gated post-MVP; selectable today
 *                with a hint that the option is sp_admin-approved).
 *   - `tenant`   default; portal + workspace users in the same tenant.
 *   - `sp_only`  service provider admins only (cross-tenant visibility).
 */
export interface VisibilitySelectorProps {
  readonly value: KbVisibility;
  readonly onChange: (v: KbVisibility) => void;
  readonly disabled?: boolean;
}

const OPTIONS: ReadonlyArray<KbVisibility> = ["public", "tenant", "sp_only"];

export function VisibilitySelector({ value, onChange, disabled }: VisibilitySelectorProps) {
  const { t } = useTranslation("workspace");
  return (
    <fieldset
      className="sdm-kb-editor-visibility"
      data-testid="kb-editor-visibility"
      disabled={disabled}
    >
      <legend className="sdm-kb-editor-visibility-legend">{t("kb.editor.visibility.title")}</legend>
      {OPTIONS.map((opt) => {
        const inputId = `kb-visibility-${opt}`;
        return (
          <div key={opt} className="sdm-kb-editor-visibility-row">
            <input
              id={inputId}
              type="radio"
              name="kb-visibility"
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              data-testid={`kb-editor-visibility-${opt}`}
            />
            <label htmlFor={inputId} className="sdm-kb-editor-visibility-label">
              <strong>{t(`kb.editor.visibility.${opt}.label`)}</strong>
              <span className="sdm-kb-editor-visibility-hint">
                {t(`kb.editor.visibility.${opt}.hint`)}
              </span>
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
