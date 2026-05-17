import { faker } from "@faker-js/faker";
import {
  kbArticleId,
  kbCategoryId,
  userId,
  type KbArticle,
  type KbCategory,
  type KbDocType,
  type KbStatus,
  type TenantId,
} from "@sdm/domain";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

const DOC_TYPES: readonly KbDocType[] = ["FAQ", "HOW_TO", "KNOWN_ERROR", "WORKAROUND", "REFERENCE"];
const STATUSES: readonly KbStatus[] = ["DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "RETIRED"];

const CATEGORY_SEEDS = [
  { id: "kb-cat-networking", name: "Networking" },
  { id: "kb-cat-software", name: "Software" },
  { id: "kb-cat-access", name: "Access & Identity" },
  { id: "kb-cat-hardware", name: "Hardware" },
] as const;

export const kbCategoriesFixture: readonly KbCategory[] = CATEGORY_SEEDS.flatMap((seed) =>
  [TENANT_ACME, TENANT_GLOBEX].map((tenant) => ({
    id: kbCategoryId(`${seed.id}:${tenant}`),
    name: seed.name,
    parentId: null,
    description: null,
    tenantId: tenant,
  })),
);

faker.seed(423);

const COUNT = 30;

export const kbArticlesFixture: readonly KbArticle[] = Array.from({ length: COUNT }, (_, i) => {
  const tenant: TenantId = i % 3 === 0 ? TENANT_GLOBEX : TENANT_ACME;
  const status = STATUSES[i % STATUSES.length] as KbStatus;
  const docType = DOC_TYPES[i % DOC_TYPES.length] as KbDocType;
  const category = CATEGORY_SEEDS[i % CATEGORY_SEEDS.length];
  if (!category) throw new Error("category seed missing");
  return {
    id: kbArticleId(`kb:${50000 + i}`),
    docTypeId: docType,
    title: faker.lorem.sentence({ min: 3, max: 7 }),
    summary: faker.lorem.sentence(),
    body: {
      blocks: [
        { kind: "heading" as const, level: 1, text: faker.lorem.sentence({ min: 2, max: 5 }) },
        { kind: "paragraph" as const, text: faker.lorem.paragraph() },
      ],
    },
    status,
    priority: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
    authorId: userId(`user-${(i % 6) + 1}`),
    ownerId: userId(`user-${((i + 1) % 6) + 1}`),
    assigneeId: null,
    subjectExpertId: null,
    productId: null,
    relevance: faker.number.int({ min: 0, max: 100 }),
    hits: faker.number.int({ min: 0, max: 500 }),
    acceptedHits: faker.number.int({ min: 0, max: 200 }),
    buResult: null,
    categoryId: kbCategoryId(`${category.id}:${tenant}`),
    attachmentIds: [],
    previousVersionId: null,
    effectiveFrom: status === "PUBLISHED" ? faker.date.recent({ days: 90 }).toISOString() : null,
    expiresAt: null,
    createdAt: faker.date.past({ years: 1 }).toISOString(),
    lastModifiedAt: faker.date.recent({ days: 30 }).toISOString(),
    tenantId: tenant,
  };
});
