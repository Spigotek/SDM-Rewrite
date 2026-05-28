import { useEffect, useId, useState } from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { Checkbox, Select, TextArea, TextField } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { searchCis, searchUsers, type CiOption, type UserOption } from "../api";
import type { CatalogField, CatalogFieldOption } from "../types";

/**
 * Per-type field dispatch — the schema-driven half of the DynamicForm.
 *
 * The renderer reads the field's `type` and renders the matching input from
 * the design system. Validation is pre-built into the Zod schema; here we
 * only translate i18n keys for the error message and wire the change/value
 * back into RHF's `Controller`.
 *
 * Field-type table (matches `design-system/components.md
 * §ServiceCatalogRenderer`):
 *   text             → TextField
 *   textarea         → TextArea
 *   number           → TextField type="number"
 *   date             → TextField type="date"
 *   select           → Select
 *   multi            → grouped checkbox list
 *   radio            → fieldset/legend + radio inputs
 *   checkbox         → Checkbox
 *   file             → placeholder block (upload deferred — H.6+)
 *   user-picker      → async lookup via `/api/users?q=`
 *   ci-picker        → async lookup via `/api/cmdb?q=`
 *   markdown-help    → read-only block (plain text in H.5; rich markdown H.6)
 *
 * Conditional fields are handled by the parent DynamicForm — when
 * `visibleIf` evaluates falsy, this renderer is unmounted entirely (so RHF
 * unregisters the value and validation skips it).
 */

export interface FieldRendererProps {
  readonly field: CatalogField;
  // RHF wires control via the generic `Control<Record<string, unknown>>` shape
  // — values come from `buildDefaultValues` and are validated by Zod.
  readonly control: Control<Record<string, unknown>>;
  readonly errors: FieldErrors<Record<string, unknown>>;
}

function useFieldError(
  errors: FieldErrors<Record<string, unknown>>,
  key: string,
): string | undefined {
  const message = errors[key]?.message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

export function FieldRenderer(props: FieldRendererProps) {
  const { field, control, errors } = props;
  const { t } = useTranslation("portal");
  const errorKey = useFieldError(errors, field.key);
  const error = errorKey ? t(errorKey) : undefined;

  switch (field.type) {
    case "text":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <TextField
              label={field.label}
              required={field.required}
              {...(field.helper ? { helper: field.helper } : {})}
              {...(field.placeholder ? { placeholder: field.placeholder } : {})}
              {...(error ? { error } : {})}
              value={typeof rhf.value === "string" ? rhf.value : ""}
              onChange={rhf.onChange}
              onBlur={rhf.onBlur}
              data-testid={`catalog-field-${field.key}`}
            />
          )}
        />
      );

    case "textarea":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <TextArea
              label={field.label}
              required={field.required}
              {...(field.helper ? { helper: field.helper } : {})}
              {...(field.placeholder ? { placeholder: field.placeholder } : {})}
              {...(error ? { error } : {})}
              rows={5}
              value={typeof rhf.value === "string" ? rhf.value : ""}
              onChange={rhf.onChange}
              onBlur={rhf.onBlur}
              data-testid={`catalog-field-${field.key}`}
            />
          )}
        />
      );

    case "number":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <TextField
              type="number"
              label={field.label}
              required={field.required}
              {...(field.helper ? { helper: field.helper } : {})}
              {...(field.placeholder ? { placeholder: field.placeholder } : {})}
              {...(error ? { error } : {})}
              {...(typeof field.min === "number" ? { min: field.min } : {})}
              {...(typeof field.max === "number" ? { max: field.max } : {})}
              value={
                rhf.value === undefined || rhf.value === null ? "" : String(rhf.value as number)
              }
              onChange={(e) => {
                const v = (e.target as HTMLInputElement).value;
                rhf.onChange(v === "" ? undefined : Number(v));
              }}
              onBlur={rhf.onBlur}
              data-testid={`catalog-field-${field.key}`}
            />
          )}
        />
      );

    case "date":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <DateField
              field={field}
              value={typeof rhf.value === "string" ? rhf.value : ""}
              onChange={rhf.onChange}
              onBlur={rhf.onBlur}
              {...(error ? { error } : {})}
            />
          )}
        />
      );

    case "select":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <Select
              label={field.label}
              required={field.required}
              {...(field.helper ? { helper: field.helper } : {})}
              {...(field.placeholder ? { placeholder: field.placeholder } : {})}
              {...(error ? { error } : {})}
              options={(field.options ?? []) as ReadonlyArray<CatalogFieldOption>}
              value={typeof rhf.value === "string" ? rhf.value : ""}
              onValueChange={rhf.onChange}
              name={field.key}
            />
          )}
        />
      );

    case "multi":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <MultiCheckboxField
              field={field}
              value={Array.isArray(rhf.value) ? (rhf.value as ReadonlyArray<string>) : []}
              onChange={rhf.onChange}
              {...(error ? { error } : {})}
            />
          )}
        />
      );

    case "radio":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <RadioField
              field={field}
              value={typeof rhf.value === "string" ? rhf.value : ""}
              onChange={rhf.onChange}
              {...(error ? { error } : {})}
            />
          )}
        />
      );

    case "checkbox":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <div className="sdm-catalog-field-checkbox">
              <Checkbox
                label={field.label}
                checked={Boolean(rhf.value)}
                onCheckedChange={(state) => rhf.onChange(state === true)}
                required={field.required}
                name={field.key}
              />
              {error ? (
                <span role="alert" className="sdm-catalog-field-error">
                  {error}
                </span>
              ) : field.helper ? (
                <span className="sdm-catalog-field-helper">{field.helper}</span>
              ) : null}
            </div>
          )}
        />
      );

    case "file":
      return <FilePlaceholder field={field} />;

    case "user-picker":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <UserPickerField
              field={field}
              value={typeof rhf.value === "string" ? rhf.value : ""}
              onChange={rhf.onChange}
              {...(error ? { error } : {})}
            />
          )}
        />
      );

    case "ci-picker":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: rhf }) => (
            <CiPickerField
              field={field}
              value={typeof rhf.value === "string" ? rhf.value : ""}
              onChange={rhf.onChange}
              {...(error ? { error } : {})}
            />
          )}
        />
      );

    case "markdown-help":
      return <MarkdownHelpBlock field={field} />;
  }
}

// ─── Date input ────────────────────────────────────────────────────────────
// The design-system TextField intentionally limits its `type` union to the
// 7 baseline HTML types — `date` is not yet covered (R-007 date picker is
// pending until v1 React Aria DatePicker). For H.5 we ship a tokenised
// native `<input type="date">` so the renderer stays schema-driven without
// touching the design-system surface. When the DS DatePicker lands the
// implementation here switches over and the rest of the registry is
// untouched.

interface DateFieldProps {
  readonly field: CatalogField;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur: () => void;
  readonly error?: string;
}

function DateField({ field, value, onChange, onBlur, error }: DateFieldProps) {
  const reactId = useId();
  const id = `date-${field.key}-${reactId}`;
  const helperId = field.helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="sdm-catalog-field-date">
      <label htmlFor={id} className="sdm-catalog-field-date-label">
        {field.label}
        {field.required && (
          <span className="sdm-catalog-field-required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        onBlur={onBlur}
        aria-required={field.required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? helperId}
        className="sdm-catalog-field-date-input"
        data-testid={`catalog-field-${field.key}`}
      />
      {error ? (
        <span id={errorId} role="alert" className="sdm-catalog-field-error">
          {error}
        </span>
      ) : field.helper ? (
        <span id={helperId} className="sdm-catalog-field-helper">
          {field.helper}
        </span>
      ) : null}
    </div>
  );
}

// ─── Radio group ───────────────────────────────────────────────────────────

interface RadioFieldProps {
  readonly field: CatalogField;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
}

function RadioField({ field, value, onChange, error }: RadioFieldProps) {
  const reactId = useId();
  const groupId = `${field.key}-${reactId}`;
  const helperId = field.helper ? `${groupId}-helper` : undefined;
  const errorId = error ? `${groupId}-error` : undefined;
  return (
    <fieldset
      className="sdm-catalog-field-radio-group"
      role="radiogroup"
      aria-required={field.required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId ?? helperId}
      data-testid={`catalog-field-${field.key}`}
    >
      <legend className="sdm-catalog-field-radio-legend">
        {field.label}
        {field.required && (
          <span className="sdm-catalog-field-required" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className="sdm-catalog-field-radio-options">
        {(field.options ?? []).map((opt) => {
          const id = `${groupId}-${opt.value}`;
          return (
            <label key={opt.value} htmlFor={id} className="sdm-catalog-field-radio-option">
              <input
                id={id}
                type="radio"
                name={field.key}
                value={opt.value}
                checked={value === opt.value}
                onChange={(e) => onChange(e.target.value)}
                data-testid={`catalog-field-${field.key}-${opt.value}`}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <span id={errorId} role="alert" className="sdm-catalog-field-error">
          {error}
        </span>
      ) : field.helper ? (
        <span id={helperId} className="sdm-catalog-field-helper">
          {field.helper}
        </span>
      ) : null}
    </fieldset>
  );
}

// ─── Multi-checkbox ────────────────────────────────────────────────────────

interface MultiCheckboxFieldProps {
  readonly field: CatalogField;
  readonly value: ReadonlyArray<string>;
  readonly onChange: (value: ReadonlyArray<string>) => void;
  readonly error?: string;
}

function MultiCheckboxField({ field, value, onChange, error }: MultiCheckboxFieldProps) {
  const reactId = useId();
  const groupId = `${field.key}-${reactId}`;
  return (
    <fieldset
      className="sdm-catalog-field-multi"
      aria-required={field.required || undefined}
      aria-invalid={error ? true : undefined}
      data-testid={`catalog-field-${field.key}`}
    >
      <legend className="sdm-catalog-field-radio-legend">
        {field.label}
        {field.required && (
          <span className="sdm-catalog-field-required" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className="sdm-catalog-field-multi-options">
        {(field.options ?? []).map((opt) => {
          const id = `${groupId}-${opt.value}`;
          const checked = value.includes(opt.value);
          return (
            <label key={opt.value} htmlFor={id} className="sdm-catalog-field-multi-option">
              <input
                id={id}
                type="checkbox"
                value={opt.value}
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) onChange([...value, opt.value]);
                  else onChange(value.filter((v) => v !== opt.value));
                }}
                data-testid={`catalog-field-${field.key}-${opt.value}`}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <span role="alert" className="sdm-catalog-field-error">
          {error}
        </span>
      ) : field.helper ? (
        <span className="sdm-catalog-field-helper">{field.helper}</span>
      ) : null}
    </fieldset>
  );
}

// ─── File placeholder ──────────────────────────────────────────────────────

function FilePlaceholder({ field }: { field: CatalogField }) {
  const { t } = useTranslation("portal");
  return (
    <div
      className="sdm-catalog-field-file"
      data-testid={`catalog-field-${field.key}`}
      title={t("catalogBrowse.fields.fileDeferredTooltip")}
    >
      <span className="sdm-catalog-field-radio-legend">
        {field.label}
        {field.required && (
          <span className="sdm-catalog-field-required" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <span className="sdm-catalog-field-file-hint">{t("catalogBrowse.fields.fileDeferred")}</span>
    </div>
  );
}

// ─── User picker ──────────────────────────────────────────────────────────

interface PickerFieldProps {
  readonly field: CatalogField;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
}

function UserPickerField({ field, value, onChange, error }: PickerFieldProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ReadonlyArray<UserOption>>([]);
  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void searchUsers(query).then((users) => {
        if (!cancelled) setOptions(users);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const selectOptions = options.map((u) => ({
    value: u.id,
    label: `${u.displayName} (${u.email})`,
  }));

  return (
    <div className="sdm-catalog-field-picker" data-testid={`catalog-field-${field.key}`}>
      <TextField
        label={field.label}
        required={field.required}
        placeholder="Začni písať meno…"
        value={query}
        onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
        data-testid={`catalog-field-${field.key}-query`}
      />
      <Select
        label={`${field.label} — výber`}
        srOnlyLabel
        options={selectOptions}
        value={value}
        onValueChange={onChange}
        {...(error ? { error } : {})}
        name={field.key}
      />
    </div>
  );
}

function CiPickerField({ field, value, onChange, error }: PickerFieldProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ReadonlyArray<CiOption>>([]);
  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void searchCis(query).then((cis) => {
        if (!cancelled) setOptions(cis);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const selectOptions = options.map((c) => ({ value: c.id, label: `${c.name} (${c.class})` }));

  return (
    <div className="sdm-catalog-field-picker" data-testid={`catalog-field-${field.key}`}>
      <TextField
        label={field.label}
        required={field.required}
        placeholder="Začni písať názov CI…"
        value={query}
        onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
        data-testid={`catalog-field-${field.key}-query`}
      />
      <Select
        label={`${field.label} — výber`}
        srOnlyLabel
        options={selectOptions}
        value={value}
        onValueChange={onChange}
        {...(error ? { error } : {})}
        name={field.key}
      />
    </div>
  );
}

// ─── Markdown help (plain text in H.5) ─────────────────────────────────────

function MarkdownHelpBlock({ field }: { field: CatalogField }) {
  // H.5 ships markdown-help as plain text. react-markdown lands in H.6 (KB)
  // and the renderer will be swapped in then. The `whiteSpace: pre-line`
  // honours linebreaks from the schema content without HTML interpretation,
  // and `aria-label="hint"` exposes the role to AT.
  return (
    <aside
      className="sdm-catalog-field-markdown-help"
      data-testid={`catalog-field-${field.key}`}
      aria-label={field.label}
    >
      <strong>{field.label}</strong>
      <p>{field.content ?? ""}</p>
    </aside>
  );
}
