# ADR-06 — Dynamic forms (Service Catalog)

**Status**: accepted (knižnica finalizovaná v r2)
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1+2)

## Changelog (round 2)

- 06 v `tech-stack-selector/libraries.md` zvolil **React Hook Form + Zod**.
- ADR fixuje knižnicu na `react-hook-form` 7 + `zod` 3 + `@hookform/resolvers/zod`.
- Doplnená sekcia §4 **JSON Schema → Zod bridge** — ako sa BFF `DynamicFormSchema`
  premieta na Zod schema runtime side, žiadny build step.
- Flag `form-library` (ADR-04) + `i18n-library-choice` (ADR-07) sa pretínajú.
  Tu ADR-06 fixuje len form runtime.

## Kontext

Service Catalog (P-03) je kľúčový flow pre `requester_lucia`. Každá katalógová
položka má **vlastný formulár** s 3–15 poliami rôznych typov (text, number,
date, select, multi-select, file, user-picker, ci-picker). Formulár je
definovaný **adminom v CA SDM Service Catalog**, nie zakódovaný v FE.

Riziká:
- UX agent (R-001): "bez detailu schémy nedokážeme navrhnúť form rendering".
- api-analyst (`gaps.md` #3): `/getOfferings` vracia len summary; **option
  detail (input type, validation, default) nie je v PDF dokumentovaný.**
- 03-domain-modeller flag: `RequestFormData` modelovaný ako `unknown` payload
  kým API nedoručí schému.

Workspace persony (Marek, Jana, Robert) majú menej dynamic forms — typicky
fixed structure (KB article editor, CMDB CI detail), ktoré sa rendrujú
deterministicky podľa `@sdm/domain` schémy.

## Rozhodnutie

**JSON-schema-driven renderer s field-type catalog**, kde BFF normalizuje
CA SDM Service Catalog template do FE-friendly JSON schema:

```ts
// @sdm/domain/forms/dynamic-form-schema.ts
type DynamicFormSchema = {
  id: string;                             // catalog item ID
  title: string;
  description?: string;
  fields: DynamicFormField[];
  layout?: { sections?: FormSection[] };  // optional grouping
};

type DynamicFormField =
  | { kind: "text"; key: string; label: string; required?: boolean;
      maxLength?: number; pattern?: string; placeholder?: string }
  | { kind: "textarea"; key: string; label: string; required?: boolean;
      maxLength?: number; rows?: number }
  | { kind: "number"; key: string; label: string; required?: boolean;
      min?: number; max?: number; step?: number }
  | { kind: "date"; key: string; label: string; required?: boolean;
      minDate?: string; maxDate?: string }
  | { kind: "select"; key: string; label: string; required?: boolean;
      options: { value: string; label: string }[] }
  | { kind: "multi-select"; key: string; label: string; required?: boolean;
      options: { value: string; label: string }[]; max?: number }
  | { kind: "file"; key: string; label: string; required?: boolean;
      accept?: string; maxSizeMB?: number; multiple?: boolean }
  | { kind: "user-picker"; key: string; label: string; required?: boolean;
      filter?: { group?: string; role?: string } }
  | { kind: "ci-picker"; key: string; label: string; required?: boolean;
      ciClass?: string[] }
  | { kind: "checkbox"; key: string; label: string };
```

**Renderer** (`@sdm/design-system/forms/JsonSchemaForm.tsx`) je framework-bound
(podľa 06 Tech Stack), ale schema je framework-agnostic.

**BFF normalizácia**: `GET /api/catalog/items/:id` vracia `DynamicFormSchema`
zostavený z CA SDM Service Catalog template. Implementačný detail flow-u
patrí api-analyst (`gaps.md` #3 a flag `service-catalog-form-schema`).

**Validation**:
- **Client-side**: `react-hook-form` 7 + `zod` 3 + `@hookform/resolvers/zod`.
  Zod schema je generovaná runtime z `DynamicFormSchema` cez
  `@sdm/domain/forms/schemaToZod.ts` (žiadny build step, žiadny code-gen).
- **Server-side**: BFF re-validuje cez identickú Zod schema pred posunom do
  CA SDM. Žiadny trust v client validation.

## 4. JSON Schema → Zod bridge

```ts
// @sdm/domain/forms/schemaToZod.ts
import { z, ZodTypeAny } from "zod";
import type { DynamicFormSchema, DynamicFormField } from "./dynamic-form-schema";

export function schemaToZod(schema: DynamicFormSchema): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const field of schema.fields) {
    shape[field.key] = fieldToZod(field);
  }
  return z.object(shape);
}

function fieldToZod(f: DynamicFormField): ZodTypeAny {
  let s: ZodTypeAny;
  switch (f.kind) {
    case "text":
    case "textarea": {
      let str = z.string();
      if (f.maxLength) str = str.max(f.maxLength);
      if ("pattern" in f && f.pattern) str = str.regex(new RegExp(f.pattern));
      s = str;
      break;
    }
    case "number": {
      let num = z.number();
      if (f.min !== undefined) num = num.min(f.min);
      if (f.max !== undefined) num = num.max(f.max);
      s = num;
      break;
    }
    case "select":
      s = z.enum(f.options.map(o => o.value) as [string, ...string[]]);
      break;
    case "multi-select":
      s = z.array(z.enum(f.options.map(o => o.value) as [string, ...string[]]));
      if (f.max) s = (s as z.ZodArray<z.ZodEnum<[string, ...string[]]>>).max(f.max);
      break;
    case "date":
      s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
      break;
    case "file":
      s = z.array(z.instanceof(File));
      break;
    case "user-picker":
    case "ci-picker":
      s = z.string().min(1);                              // ID
      break;
    case "checkbox":
      s = z.boolean();
      break;
  }
  if (!("required" in f) || !f.required) s = s.optional();
  return s;
}
```

Renderer setup (informačné):

```tsx
// @sdm/design-system/forms/JsonSchemaForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZod } from "@sdm/domain/forms/schemaToZod";

export function JsonSchemaForm({ schema, onSubmit }: Props) {
  const zodSchema = useMemo(() => schemaToZod(schema), [schema]);
  const form = useForm({ resolver: zodResolver(zodSchema), mode: "onBlur" });
  // render fields per kind, propagate form.register / form.control
}
```

Žiadna external knižnica `zod-from-json-schema`. Naša schema (`DynamicFormSchema`)
je menší, doménový subset — vlastný 60-LOC bridge je predvídateľnejší.

## Dôsledky

**Pozitívne**:
1. **Jeden renderer pre N formulárov** — pridanie nového catalog item v CA SDM
   automaticky funguje, žiadny FE deploy.
2. **Type-safe schema** — `DynamicFormSchema` je v `@sdm/domain`, BFF + FE
   majú zdieľaný typ.
3. **Reusable mimo Service Catalog** — `JsonSchemaForm` sa dá použiť aj
   pre admin settings (W-13, post-MVP) alebo per-tenant config formy.
4. **Extensibility cez `kind`** — pridanie nového field type je nové variant
   v discriminated union + nový case v renderer.
5. **i18n** — `label`, `placeholder`, options sú translatable cez ICU keys
   pri BFF normalizácii (BFF si vyžiada locale per session a vyplní localizované
   labels — alebo posiela kľúče a FE ich resolveuje cez `@sdm/i18n`).

**Negatívne**:
1. **BFF musí pochopiť CA SDM Service Catalog template formát** — gap #3
   v api-analyst. Implementačný spike potrebný pred MVP.
2. **Renderer komplexita** — file upload, picker komponenty, conditional
   visibility (ak Service Catalog má `attrCtrl` dependencies, BFF musí
   poslať conditional rules: "ak field A = X, field B je required").
3. **Validation duplication** — schema constraints sa serializujú do JSON,
   ale CA SDM má vlastné backend rules (napr. SLA priority calc). BFF
   stratégia: posielame CA SDM error response na FE ak server validation
   zlyhá; client validation je len pre UX feedback.

## Alternatívy

### A) FE-zakódované formuláre per catalog item

**Prečo zamietnuté**:
- Každá zmena catalog item v CA SDM = FE deploy. Nepoužiteľné.
- Tisíce LOC ručného form code.

### B) Renderovať CA SDM Service Point widget v iframe

**Prečo zamietnuté**:
- UX katastrofa — iframe nemá kontrolu nad styling-om, žiadny shared
  tenant switcher, broken back button.
- Service Point widget je legacy UI, ktorý práve chceme nahradiť.
- Cross-origin issues.

### C) `react-jsonschema-form` (RJSF) ako out-of-the-box knižnica

**Prečo nezvolené ako default**:
- RJSF používa JSON Schema (Draft 7) ako vstup. Náš `DynamicFormSchema` je
  jednoduchší a viac doménový (user-picker, ci-picker, file s constraints).
- RJSF je veľký bundle, zložitý overrides API.
- Náš schema je menší podset → vlastný renderer (200-400 LOC) sa nám oplatí.

### D) GraphQL form schema (vlastný server side)

**Prečo zamietnuté**:
- Pridávame GraphQL bez ostatných benefit-ov. Overkill.

## Otvorené závislosti

| # | Flag | Smer | Popis | Status |
|---|---|---|---|---|
| 0 | `form-runtime-library` | (vlastné) | React Hook Form 7 + Zod 3. | `[resolved-in-round-2]` — 06 stack pick. |
| 1 | `service-catalog-source` | → 01-api-analyst | Detail CA SDM Service Catalog template formátu — gap #3. | open (inherent API gap) |
| 2 | `conditional-fields` | → 01-api-analyst | `attrCtrl` BUI endpoint v CA SDM — schema musí podporovať `visibleIf` / `requiredIf`. | open (inherent API gap) |
| 3 | `dynamic-form-i18n` | → 07-design-system | Labels — BFF posiela hotové localized stringy alebo kľúče. | open (07 + 04 detail) |
| 4 | `pick-component-source` | → 01-api-analyst | `user-picker` a `ci-picker` backend search endpointy. | open (inherent API gap) |
