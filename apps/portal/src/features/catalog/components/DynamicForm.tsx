import { useEffect, useMemo, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { usePendingChanges } from "../../../shell/pending-changes";
import { buildDefaultValues, buildZodSchema } from "../schema-builder";
import { FieldRenderer } from "./FieldRenderer";
import type { CatalogField, CatalogItem } from "../types";

/**
 * `DynamicForm` — schema-driven entry form for a Service Catalog item.
 *
 * The schema is built **per-mount** from the field list (`useMemo` keyed on
 * the field array reference so a re-render of the parent doesn't rebuild
 * unless the schema actually changed). Default values come from the matching
 * `buildDefaultValues` so RHF stays controlled-vs-uncontrolled consistent.
 *
 * Conditional visibility: fields with a `visibleIf` predicate are not rendered
 * (and not validated) unless the watched field equals the predicate value.
 * Show/hide transitions update an `aria-live="polite"` region per
 * `microcopy.md §13` so screen readers announce the change.
 *
 * Submit calls the parent `onSubmit` with the dynamic field map plus a default
 * summary (`item.name`) — the caller posts to `POST /api/requests` and
 * navigates to the success screen.
 */

export interface DynamicFormProps {
  readonly item: CatalogItem;
  readonly fields: ReadonlyArray<CatalogField>;
  readonly onSubmit: (values: Readonly<Record<string, unknown>>) => Promise<void> | void;
  readonly onCancel: () => void;
  readonly submitting?: boolean;
  readonly serverError?: string | null;
}

const FORM_ID = "portal-catalog-request";

export function DynamicForm(props: DynamicFormProps) {
  const { item, fields, onSubmit, onCancel, submitting, serverError } = props;
  const { t } = useTranslation("portal");
  const { register: registerDirty } = usePendingChanges();

  const defaultValues = useMemo(() => buildDefaultValues(fields), [fields]);

  // I.1 fix for journey-02 acceptance: build the Zod schema dynamically based
  // on the *currently visible* field set. A `visibleIf`-hidden conditional
  // field (e.g. `colleague` user-picker when `audience === "self"`) must not
  // be required on submit. With a static schema the hidden field's default
  // `""` value silently failed `.min(1)` and submit dropped the click. This
  // was masked in dev mode by React Strict-Mode double-mount cycles that
  // toggled the field state but consistently broke the preview-build journey.
  // `shouldUnregister: true` complements the dynamic schema so RHF state and
  // the validator stay in lockstep when conditional fields toggle.
  const form = useForm({
    mode: "onTouched",
    shouldUnregister: true,
    defaultValues: defaultValues as Record<string, unknown>,
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
  } = form;

  // Pending-changes guard: register dirty marker on first user input.
  useEffect(() => {
    if (!isDirty) return;
    const release = registerDirty(FORM_ID);
    return release;
  }, [isDirty, registerDirty]);

  // Snapshot watched values for visibility evaluation. Watching all values
  // is acceptable here — Service Catalog forms are small (≤ 15 fields) so the
  // re-render cost is negligible.
  const allValues = watch();

  // Pre-compute visible/hidden split for the announce region.
  const visibilityState = useMemo(() => {
    const visible = new Set<string>();
    const hidden = new Set<string>();
    for (const f of fields) {
      if (isVisible(f, allValues)) visible.add(f.key);
      else hidden.add(f.key);
    }
    return { visible, hidden };
  }, [fields, allValues]);

  // Resolver is rebuilt every render against the *currently visible* fields
  // so a conditional branch (e.g. `colleague` when `audience !== "colleague"`)
  // is not required on submit. The `handleSubmit` closure captures this
  // resolver each render — no extra dependency tracking needed.
  const visibleFields = useMemo(
    () => fields.filter((f) => visibilityState.visible.has(f.key)),
    [fields, visibilityState.visible],
  );
  const visibleSchema = useMemo(() => buildZodSchema(visibleFields), [visibleFields]);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleSubmit(async (values) => {
      const parsed = visibleSchema.safeParse(values);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? "");
          if (!key) continue;
          form.setError(key, { type: "manual", message: issue.message });
        }
        return;
      }
      const cleaned: Record<string, unknown> = {};
      for (const f of visibleFields) {
        if (f.type === "markdown-help") continue;
        cleaned[f.key] = (parsed.data as Record<string, unknown>)[f.key];
      }
      await onSubmit(cleaned);
    })(e);
  };

  return (
    <form
      id={FORM_ID}
      className="sdm-catalog-form"
      onSubmit={submit}
      noValidate
      data-testid="catalog-form"
      aria-label={t("catalogBrowse.form.ariaLabel", { name: item.name })}
    >
      <div className="sdm-catalog-form-fields">
        {fields.map((field) => {
          if (!visibilityState.visible.has(field.key)) return null;
          return (
            <FieldRenderer
              key={field.key}
              field={field}
              control={control as never}
              errors={errors as never}
            />
          );
        })}
      </div>

      {item.cost ? (
        <div className="sdm-catalog-form-cost" data-testid="catalog-form-cost">
          <strong>{t("catalogBrowse.form.estimatedCost")}: </strong>
          <span>{item.cost}</span>
        </div>
      ) : null}

      {/* aria-live region for visibility transitions (microcopy.md §13). */}
      <span className="sdm-visually-hidden" aria-live="polite" data-testid="catalog-form-live">
        {Array.from(visibilityState.visible).join(",")}
      </span>

      {serverError ? (
        <p role="alert" className="sdm-catalog-form-error" data-testid="catalog-form-error">
          {serverError}
        </p>
      ) : null}

      <div className="sdm-catalog-form-actions">
        <Button
          variant="secondary"
          type="button"
          onClick={onCancel}
          data-testid="catalog-form-cancel"
        >
          {t("catalogBrowse.form.cancel")}
        </Button>
        <Button
          variant="primary"
          type="submit"
          loading={submitting === true}
          data-testid="catalog-form-submit"
        >
          {t("catalogBrowse.form.submit")}
        </Button>
      </div>
    </form>
  );
}

function isVisible(field: CatalogField, values: Record<string, unknown>): boolean {
  if (!field.visibleIf) return true;
  const ref = values[field.visibleIf.when.field];
  return typeof ref === "string" && ref === field.visibleIf.when.equals;
}
