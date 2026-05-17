import {
  auditEventsFixture,
  catalogFixture,
  changesFixture,
  ciRelationshipsFixture,
  cisFixture,
  incidentsFixture,
  kbArticlesFixture,
  kbCategoriesFixture,
  problemsFixture,
  requestsFixture,
  tenantsFixture,
  usersFixture,
} from "../fixtures";
import type { MockStore } from "./types";

function seed(): MockStore {
  return {
    tenants: [...tenantsFixture],
    users: [...usersFixture],
    incidents: [...incidentsFixture],
    requests: [...requestsFixture],
    problems: [...problemsFixture],
    changes: [...changesFixture],
    kbArticles: [...kbArticlesFixture],
    kbCategories: [...kbCategoriesFixture],
    cis: [...cisFixture],
    ciRelationships: [...ciRelationshipsFixture],
    catalog: [...catalogFixture],
    auditEvents: [...auditEventsFixture],
  };
}

export const store: MockStore = seed();

export function resetStore(): void {
  const fresh = seed();
  (Object.keys(fresh) as (keyof MockStore)[]).forEach((key) => {
    // Replace contents in place so existing references stay valid.
    const target = store[key] as unknown[];
    target.length = 0;
    target.push(...(fresh[key] as unknown[]));
  });
}
