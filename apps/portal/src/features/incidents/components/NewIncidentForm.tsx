import { useEffect, useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Select, TextArea, TextField } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { usePendingChanges } from "../../../shell/pending-changes";
import { useNewIncident } from "../hooks";
import {
  CATEGORY_CODES,
  DESCRIPTION_MAX,
  SUMMARY_MAX,
  SUMMARY_MIN,
  URGENCY_LEVELS,
  newIncidentSchema,
  type NewIncidentFormValues,
} from "../schema";
import type { Incident } from "@sdm/domain";

/**
 * `NewIncidentForm` — RHF + Zod controlled form (uncontrolled inputs under the
 * hood). Field set matches wireframe `portal/02-new-ticket.md` §UI prvky minus
 * attachments — attachments are deferred to a feature follow-up (per H.3
 * decision: ship without; BFF multipart endpoint not built).
 *
 * Validation:
 *   - Zod schema enforces required + length bounds; the resolver hands a key
 *     (`validation.required`, `validation.tooShort`, `validation.tooLong`) to
 *     the field error. We translate that key here so the on-screen text is
 *     locale-correct.
 *   - On 4xx response the form sets a root-level error (the BFF / MSW does
 *     not return per-field issues today; when it does we can `setError`
 *     per field).
 *   - On 401 we redirect to `/login` — the session-context heartbeat picks
 *     up the lost session and re-renders the login screen.
 *
 * Pending-changes integration: the form registers a single dirty token
 * (`portal-new-incident`) on the first user input. The token unregisters on
 * unmount or after successful submit (the success screen is a sibling of this
 * form). The tenant switcher uses this to prompt before discarding the draft.
 *
 * Incident attachments — still deferred (v1.2+). The wireframe §UI prvky #4
 * spec'd drag-drop + 25 MB cap; F.6 §23.6 documents `POST /api/attachments`
 * but the endpoint is not yet implemented for incidents (no multipart handler,
 * no virus-scan policy, no DS `FileUpload` primitive). KB attachments shipped
 * separately in J.5 (POST /api/attachments/kb) — see docs/plans/J.5.md.
 */

const FORM_ID = "portal-new-incident";

export interface NewIncidentFormProps {
  readonly onSuccess: (incident: Incident) => void;
  readonly onCancel: () => void;
}

interface RadioFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error: string | undefined;
  readonly legend: string;
  readonly helper: string;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly name: string;
}

function RadioField(props: RadioFieldProps) {
  const { value, onChange, error, legend, helper, options, name } = props;
  const reactId = useId();
  const groupId = `${name}-${reactId}`;
  const helperId = `${groupId}-helper`;
  const errorId = `${groupId}-error`;
  return (
    <fieldset
      className="sdm-portal-new-incident-radio-group"
      role="radiogroup"
      aria-required="true"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : helperId}
      data-testid={`${name}-group`}
    >
      <legend className="sdm-portal-new-incident-radio-legend">
        {legend}
        <span className="sdm-portal-new-incident-radio-required" aria-hidden="true">
          *
        </span>
      </legend>
      <div className="sdm-portal-new-incident-radio-options">
        {options.map((opt) => {
          const id = `${groupId}-${opt.value}`;
          return (
            <label key={opt.value} htmlFor={id} className="sdm-portal-new-incident-radio-option">
              <input
                id={id}
                type="radio"
                name={name}
                value={opt.value}
                checked={value === opt.value}
                onChange={(e) => onChange(e.target.value)}
                data-testid={`${name}-${opt.value}`}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <span id={errorId} role="alert" className="sdm-portal-new-incident-radio-error">
          {error}
        </span>
      ) : (
        <span id={helperId} className="sdm-portal-new-incident-radio-helper">
          {helper}
        </span>
      )}
    </fieldset>
  );
}

export function NewIncidentForm({ onSuccess, onCancel }: NewIncidentFormProps) {
  const { t } = useTranslation("portal");
  const { register: registerDirty } = usePendingChanges();
  const mutation = useNewIncident();

  const form = useForm<NewIncidentFormValues>({
    resolver: zodResolver(newIncidentSchema),
    mode: "onTouched",
    defaultValues: {
      summary: "",
      description: "",
      urgency: "2",
    },
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
  } = form;

  // Register the dirty marker with PendingChangesContext the first time
  // RHF flips `isDirty`. We unregister on unmount; the success screen
  // unmounts the form so the dirty marker drops naturally there too.
  useEffect(() => {
    if (!isDirty) return;
    const release = registerDirty(FORM_ID);
    return release;
  }, [isDirty, registerDirty]);

  const summaryValue = watch("summary") ?? "";
  const descriptionValue = watch("description") ?? "";

  const categoryOptions = CATEGORY_CODES.map((code) => ({
    value: code,
    label: t(`newIncident.fields.category.options.${code}`),
  }));

  const urgencyOptions = URGENCY_LEVELS.map((value) => ({
    value,
    label: t(`newIncident.fields.urgency.options.${value}`),
  }));

  function renderError(key: unknown, params: Record<string, string | number> = {}): string {
    if (typeof key !== "string" || key.length === 0) return "";
    return t(key, params);
  }

  const submit = handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: (incident) => {
        onSuccess(incident);
      },
      onError: (err) => {
        if (err.status === 401) {
          window.location.assign("/login");
        }
      },
    });
  });

  return (
    <form
      className="sdm-portal-new-incident-form"
      onSubmit={submit}
      noValidate
      data-testid="portal-new-incident-form"
      aria-label={t("newIncident.formAriaLabel")}
    >
      <Controller
        name="category"
        control={control}
        render={({ field, fieldState }) => (
          <Select
            label={t("newIncident.fields.category.label")}
            helper={t("newIncident.fields.category.helper")}
            placeholder={t("newIncident.fields.category.placeholder")}
            options={categoryOptions}
            required
            name={field.name}
            value={field.value ?? ""}
            onValueChange={field.onChange}
            {...(fieldState.error?.message ? { error: renderError(fieldState.error.message) } : {})}
          />
        )}
      />

      <TextField
        label={t("newIncident.fields.summary.label")}
        helper={t("newIncident.fields.summary.helper")}
        placeholder={t("newIncident.fields.summary.placeholder")}
        required
        maxLength={SUMMARY_MAX}
        data-testid="portal-new-incident-summary"
        aria-describedby={undefined}
        {...register("summary")}
        {...(errors.summary?.message
          ? {
              error: renderError(errors.summary.message, {
                min: SUMMARY_MIN,
                max: SUMMARY_MAX,
                current: summaryValue.length,
              }),
            }
          : {})}
      />

      <TextArea
        label={t("newIncident.fields.description.label")}
        helper={t("newIncident.fields.description.helper")}
        placeholder={t("newIncident.fields.description.placeholder")}
        rows={6}
        maxLength={DESCRIPTION_MAX}
        data-testid="portal-new-incident-description"
        {...register("description")}
        {...(errors.description?.message
          ? {
              error: renderError(errors.description.message, {
                max: DESCRIPTION_MAX,
                current: descriptionValue.length,
              }),
            }
          : {})}
      />

      <Controller
        name="urgency"
        control={control}
        render={({ field, fieldState }) => (
          <RadioField
            name="portal-new-incident-urgency"
            legend={t("newIncident.fields.urgency.label")}
            helper={t("newIncident.fields.urgency.helper")}
            options={urgencyOptions}
            value={field.value ?? ""}
            onChange={field.onChange}
            {...(fieldState.error?.message
              ? { error: renderError(fieldState.error.message) }
              : { error: undefined })}
          />
        )}
      />

      <div className="sdm-portal-new-incident-actions">
        <Button
          variant="secondary"
          type="button"
          onClick={onCancel}
          data-testid="portal-new-incident-cancel"
        >
          {t("newIncident.actions.cancel")}
        </Button>
        <div>
          {mutation.isError ? (
            <p
              role="alert"
              className="sdm-portal-new-incident-submit-error"
              data-testid="portal-new-incident-submit-error"
            >
              {t("newIncident.errors.submitFailed")}
            </p>
          ) : null}
          <Button
            variant="primary"
            type="submit"
            loading={mutation.isPending}
            data-testid="portal-new-incident-submit"
          >
            {t("newIncident.actions.submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}
