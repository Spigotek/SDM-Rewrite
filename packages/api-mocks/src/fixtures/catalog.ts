import type { CatalogOffering } from "../db/types";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

/**
 * Service Catalog fixtures — deterministic, hand-authored (no faker — the set
 * is small enough that explicit data keeps the H.5 wireframe parity obvious).
 *
 * Layout follows wireframe `portal/03-service-catalog.md`:
 *   - 4 buckets: `hardware`, `software`, `access`, `other` (matches the
 *     CategoryTiles row Hardvér / Softvér / Prístupy / Iné).
 *   - 3 items marked `featured: true` so the home grid stays compact.
 *   - At least one item per category exercises the full field-type registry
 *     (text, textarea, number, date, select, multi, radio, checkbox, file,
 *     user-picker, ci-picker, markdown-help) so the DynamicForm has coverage
 *     in the browser test.
 *
 * Each offering is cloned across both tenant fixtures (Acme + Globex) so the
 * tenant-isolation guard tests keep passing.
 */

const OFFERINGS: readonly Omit<CatalogOffering, "tenantId">[] = [
  {
    id: "catalog:figma",
    name: "Figma Professional License",
    description: "Ročná licencia pre design tooling.",
    category: "software",
    sla: "~ 2 dni",
    cost: "~ 180 € / ročne",
    featured: true,
    form: {
      fields: [
        {
          key: "audience",
          label: "Pre koho je licencia?",
          type: "radio",
          required: true,
          options: [
            { value: "self", label: "Pre mňa" },
            { value: "colleague", label: "Pre kolegu" },
          ],
        },
        {
          key: "colleague",
          label: "Vyber kolegu",
          type: "user-picker",
          required: true,
          visibleIf: { when: { field: "audience", equals: "colleague" } },
        },
        {
          key: "duration",
          label: "Trvanie licencie",
          type: "select",
          required: true,
          options: [
            { value: "12", label: "12 mesiacov" },
            { value: "24", label: "24 mesiacov" },
          ],
        },
        {
          key: "costCenter",
          label: "Projekt / cost center",
          type: "text",
          required: true,
          helper: 'Napr. „Brand 2026" alebo cost center kód.',
        },
        {
          key: "comment",
          label: "Komentár pre schvaľovateľa",
          type: "textarea",
          required: false,
        },
      ],
    },
  },
  {
    id: "catalog:vpn",
    name: "VPN prístup pre nového zamestnanca",
    description: "Setup VPN klienta na firemnom zariadení.",
    category: "access",
    sla: "~ 1 deň",
    featured: true,
    form: {
      fields: [
        {
          key: "intro",
          label: "Pred odoslaním",
          type: "markdown-help",
          required: false,
          content:
            "VPN prístup je automaticky priradený po HR potvrdení onboardingu. Pre **dočasný prístup** uveď trvanie nižšie.",
        },
        {
          key: "device",
          label: "Zariadenie (CMDB CI)",
          type: "ci-picker",
          required: true,
        },
        {
          key: "until",
          label: "Platnosť do",
          type: "date",
          required: true,
        },
        {
          key: "reason",
          label: "Dôvod prístupu",
          type: "textarea",
          required: true,
        },
      ],
    },
  },
  {
    id: "catalog:external-disk",
    name: "Externý disk (1 TB)",
    description: "Šifrovaný externý disk pre projekty s veľkými dátami.",
    category: "hardware",
    sla: "~ 3-5 dní",
    featured: true,
    form: {
      fields: [
        {
          key: "capacity",
          label: "Kapacita",
          type: "select",
          required: true,
          options: [
            { value: "1tb", label: "1 TB" },
            { value: "2tb", label: "2 TB" },
            { value: "4tb", label: "4 TB" },
          ],
        },
        {
          key: "encryption",
          label: "Vyžaduje šifrovanie",
          type: "checkbox",
          required: false,
        },
        {
          key: "extras",
          label: "Doplnky",
          type: "multi",
          required: false,
          options: [
            { value: "cable-usbc", label: "USB-C kábel" },
            { value: "cable-thunderbolt", label: "Thunderbolt kábel" },
            { value: "case", label: "Ochranné puzdro" },
          ],
        },
        {
          key: "justification",
          label: "Odôvodnenie",
          type: "textarea",
          required: true,
        },
        {
          key: "attachment",
          label: "Príloha (faktúra / schválenie)",
          type: "file",
          required: false,
        },
      ],
    },
  },
  {
    id: "catalog:laptop",
    name: "Nový laptop",
    description: "Firemný notebook (Linux alebo macOS).",
    category: "hardware",
    sla: "~ 5 dní",
    form: {
      fields: [
        {
          key: "model",
          label: "Preferovaný model",
          type: "select",
          required: true,
          options: [
            { value: "macbook-pro-14", label: 'MacBook Pro 14"' },
            { value: "thinkpad-x1", label: "ThinkPad X1 Carbon" },
          ],
        },
        {
          key: "ram",
          label: "Pamäť (GB)",
          type: "number",
          required: true,
          min: 16,
          max: 64,
        },
        {
          key: "justification",
          label: "Obchodné odôvodnenie",
          type: "textarea",
          required: true,
        },
      ],
    },
  },
  {
    id: "catalog:jira",
    name: "Prístup do Jiry",
    description: "Prístup k projektovým doskám a tiketingu.",
    category: "access",
    sla: "~ 1 deň",
    form: {
      fields: [
        {
          key: "project",
          label: "Projekt",
          type: "text",
          required: true,
          placeholder: "napr. SDM-REWRITE",
        },
        {
          key: "role",
          label: "Rola",
          type: "radio",
          required: true,
          options: [
            { value: "viewer", label: "Čítanie" },
            { value: "contributor", label: "Prispievateľ" },
            { value: "admin", label: "Admin" },
          ],
        },
      ],
    },
  },
  {
    id: "catalog:relocation",
    name: "Presťahovanie pracoviska",
    description: "Presun pracovnej stanice na novú lokáciu.",
    category: "other",
    sla: "~ 2 dni",
    form: {
      fields: [
        {
          key: "newLocation",
          label: "Nová lokácia",
          type: "text",
          required: true,
        },
        {
          key: "preferredDate",
          label: "Preferovaný dátum",
          type: "date",
          required: true,
        },
        {
          key: "urgent",
          label: "Urgentné",
          type: "checkbox",
          required: false,
        },
      ],
    },
  },
];

export const catalogFixture: readonly CatalogOffering[] = OFFERINGS.flatMap((o) =>
  [TENANT_ACME, TENANT_GLOBEX].map((tenant) => ({
    ...o,
    id: `${o.id}:${tenant}`,
    tenantId: tenant,
  })),
);
