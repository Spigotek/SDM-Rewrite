import { z } from "zod";
import type { CatalogField, CatalogFieldType } from "./types";

/**
 * `buildZodSchema(fields)` — registry pattern per `libraries.md §3 Pattern
 * dynamic form (Service Catalog R-001)`. Each `CatalogFieldType` has a
 * single builder that returns the per-field schema; `buildZodSchema`
 * composes them into a single `z.object`.
 *
 * Required vs. optional is handled in two places:
 *   - The base builder produces the value schema (`z.string()`, `z.number()`,
 *     etc).
 *   - The composer (`buildZodSchema`) wraps it in `.optional()` if the field
 *     is not required. For arrays the `.min(1)` is applied when required.
 *
 * Error messages return i18n keys (`validation.required`, `validation.tooShort`,
 * `validation.tooLong`, `validation.outOfRange`) — RHF's resolver hands them
 * to the field error, then `FieldRenderer` resolves them via `t()`. This keeps
 * the schema locale-agnostic (the same schema serialises to either SK or EN
 * messages depending on the active i18n context).
 *
 * `markdown-help` is a non-input field — it has no value, so it doesn't appear
 * in the schema object. The renderer still emits it but RHF never sees it.
 */

const REQUIRED = "validation.required";
const TOO_SHORT = "validation.tooShort";
const TOO_LONG = "validation.tooLong";
const OUT_OF_RANGE = "validation.outOfRange";

type FieldSchemaBuilder = (field: CatalogField) => z.ZodTypeAny;

const REGISTRY: Record<CatalogFieldType, FieldSchemaBuilder | null> = {
  text: textFieldSchema,
  textarea: textFieldSchema,
  number: numberFieldSchema,
  date: stringFieldSchema, // HTML date input → ISO `YYYY-MM-DD` string
  select: stringFieldSchema,
  multi: multiFieldSchema,
  radio: stringFieldSchema,
  checkbox: checkboxFieldSchema,
  file: fileFieldSchema,
  "user-picker": stringFieldSchema,
  "ci-picker": stringFieldSchema,
  "markdown-help": null,
};

function textFieldSchema(field: CatalogField): z.ZodTypeAny {
  let schema = z.string({ required_error: REQUIRED }).trim();
  if (typeof field.min === "number") {
    schema = schema.min(field.min, { message: TOO_SHORT });
  }
  if (typeof field.max === "number") {
    schema = schema.max(field.max, { message: TOO_LONG });
  }
  return schema;
}

function numberFieldSchema(field: CatalogField): z.ZodTypeAny {
  let schema = z.coerce
    .number({ required_error: REQUIRED, invalid_type_error: OUT_OF_RANGE })
    .finite({ message: OUT_OF_RANGE });
  if (typeof field.min === "number") {
    schema = schema.min(field.min, { message: OUT_OF_RANGE });
  }
  if (typeof field.max === "number") {
    schema = schema.max(field.max, { message: OUT_OF_RANGE });
  }
  return schema;
}

function stringFieldSchema(_field: CatalogField): z.ZodTypeAny {
  return z.string({ required_error: REQUIRED });
}

function multiFieldSchema(_field: CatalogField): z.ZodTypeAny {
  return z.array(z.string());
}

function checkboxFieldSchema(_field: CatalogField): z.ZodTypeAny {
  return z.boolean();
}

function fileFieldSchema(_field: CatalogField): z.ZodTypeAny {
  // File uploads are placeholder UI in H.5 (matches H.3 attachments
  // deferral). The submitted value is always `null` — the schema accepts
  // null + undefined so a required-but-disabled field doesn't block submit.
  return z.null().nullable().optional();
}

/**
 * Build the per-form Zod object schema from the field list. Required fields
 * become non-optional in the object; optional fields use `.optional()`. Multi
 * + checkbox special-case `required`: required multi must have at least one
 * selection (`.min(1)`); required checkbox must be `true` (refinement).
 */
export function buildZodSchema(fields: ReadonlyArray<CatalogField>): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const field of fields) {
    const builder = REGISTRY[field.type];
    if (builder === null) continue; // markdown-help is non-input
    const base = builder(field);
    shape[field.key] = decorateForRequired(base, field);
  }
  return z.object(shape);
}

function decorateForRequired(schema: z.ZodTypeAny, field: CatalogField): z.ZodTypeAny {
  if (!field.required) {
    return schema.optional().or(z.literal("").transform(() => undefined));
  }
  // For required string-like fields the empty string must fail. The string
  // schemas above only enforce `.min(field.min)`; if the caller did not set
  // `min` we still need to reject `""`.
  if (field.type === "text" || field.type === "textarea") {
    return (schema as z.ZodString).min(1, { message: REQUIRED });
  }
  if (field.type === "multi") {
    return (schema as z.ZodArray<z.ZodString>).min(1, { message: REQUIRED });
  }
  if (field.type === "checkbox") {
    return z.literal(true, { errorMap: () => ({ message: REQUIRED }) });
  }
  if (field.type === "select" || field.type === "radio") {
    return (schema as z.ZodString).min(1, { message: REQUIRED });
  }
  if (field.type === "user-picker" || field.type === "ci-picker") {
    return (schema as z.ZodString).min(1, { message: REQUIRED });
  }
  if (field.type === "date") {
    return (schema as z.ZodString).min(1, { message: REQUIRED });
  }
  return schema;
}

/**
 * Build the RHF `defaultValues` map. Each input type has its own empty value
 * so RHF doesn't bounce between controlled/uncontrolled on first render:
 *   - string-like → ""
 *   - number      → undefined (so the placeholder is visible)
 *   - multi       → []
 *   - checkbox    → false
 *   - file        → null
 */
export function buildDefaultValues(
  fields: ReadonlyArray<CatalogField>,
): Record<string, string | number | boolean | string[] | null | undefined> {
  const defaults: Record<string, string | number | boolean | string[] | null | undefined> = {};
  for (const field of fields) {
    switch (field.type) {
      case "text":
      case "textarea":
      case "date":
      case "select":
      case "radio":
      case "user-picker":
      case "ci-picker":
        defaults[field.key] = "";
        break;
      case "number":
        defaults[field.key] = undefined;
        break;
      case "multi":
        defaults[field.key] = [];
        break;
      case "checkbox":
        defaults[field.key] = false;
        break;
      case "file":
        defaults[field.key] = null;
        break;
      case "markdown-help":
        // No value — skip.
        break;
    }
  }
  return defaults;
}
