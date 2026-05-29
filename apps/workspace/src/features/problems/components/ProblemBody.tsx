import { useTranslation } from "@sdm/i18n";
import type { ProblemDetail } from "../types";

/**
 * Problem body — Description + Root cause analysis blocks. Both are plain text
 * blocks (per `problem-management.md`) rendered with `white-space: pre-wrap`.
 * No markdown for now — the RCA flow doesn't require formatting affordances at
 * MVP, and the F.2 entity proxy returns the field as raw `description` /
 * `rootCause` strings.
 */
export function ProblemBody({ detail }: { readonly detail: ProblemDetail }) {
  const { t } = useTranslation("workspace");

  return (
    <>
      <section className="sdm-problem-section" data-testid="problem-description">
        <h2 className="sdm-problem-section-title">{t("problems.fields.description")}</h2>
        {detail.description ? (
          <p className="sdm-problem-body-text">{detail.description}</p>
        ) : (
          <p className="sdm-problem-body-empty">{t("problems.fields.descriptionEmpty")}</p>
        )}
      </section>

      <section className="sdm-problem-section" data-testid="problem-rootcause">
        <h2 className="sdm-problem-section-title">{t("problems.fields.rootCause")}</h2>
        {detail.rootCause ? (
          <p className="sdm-problem-body-text">{detail.rootCause}</p>
        ) : (
          <p className="sdm-problem-body-empty">{t("problems.fields.rootCauseEmpty")}</p>
        )}
      </section>
    </>
  );
}
