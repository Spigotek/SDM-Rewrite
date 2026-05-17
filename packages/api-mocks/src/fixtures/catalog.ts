import type { CatalogOffering } from "../db/types";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

const TENANTS = [TENANT_ACME, TENANT_GLOBEX] as const;

const OFFERINGS: readonly Omit<CatalogOffering, "tenantId">[] = [
  {
    id: "catalog:offering-1",
    name: "New laptop",
    description: "Request a corporate laptop (Linux or macOS).",
    category: "hardware",
    form: {
      fields: [
        {
          key: "model",
          label: "Model preference",
          type: "select",
          required: true,
          options: [
            { value: "macbook-pro-14", label: 'MacBook Pro 14"' },
            { value: "thinkpad-x1", label: "ThinkPad X1 Carbon" },
          ],
        },
        { key: "justification", label: "Business justification", type: "textarea", required: true },
      ],
    },
  },
  {
    id: "catalog:offering-2",
    name: "Software access",
    description: "Request access to enterprise applications (Jira, Confluence, Slack).",
    category: "access",
    form: {
      fields: [
        {
          key: "application",
          label: "Application",
          type: "select",
          required: true,
          options: [
            { value: "jira", label: "Jira" },
            { value: "confluence", label: "Confluence" },
            { value: "slack", label: "Slack" },
          ],
        },
        { key: "duration", label: "Access duration (days)", type: "number", required: true },
      ],
    },
  },
  {
    id: "catalog:offering-3",
    name: "Office relocation",
    description: "Request workstation move to a new office location.",
    category: "facilities",
    form: {
      fields: [
        { key: "newLocation", label: "New location", type: "text", required: true },
        { key: "preferredDate", label: "Preferred date", type: "text", required: true },
        { key: "urgent", label: "Urgent", type: "boolean", required: false },
      ],
    },
  },
  {
    id: "catalog:offering-4",
    name: "VPN access",
    description: "Request remote VPN credentials for off-site work.",
    category: "access",
    form: {
      fields: [{ key: "reason", label: "Reason", type: "textarea", required: true }],
    },
  },
  {
    id: "catalog:offering-5",
    name: "Phone provisioning",
    description: "Issue a corporate mobile phone.",
    category: "hardware",
    form: {
      fields: [
        {
          key: "phoneType",
          label: "Phone type",
          type: "select",
          required: true,
          options: [
            { value: "iphone", label: "iPhone" },
            { value: "android", label: "Android" },
          ],
        },
        { key: "international", label: "International roaming", type: "boolean", required: false },
      ],
    },
  },
];

export const catalogFixture: readonly CatalogOffering[] = OFFERINGS.flatMap((o) =>
  TENANTS.map((tenant) => ({ ...o, id: `${o.id}:${tenant}`, tenantId: tenant })),
);
