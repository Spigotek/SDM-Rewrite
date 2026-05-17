import { http, HttpResponse } from "msw";
import { store } from "../db";
import type { KbArticle } from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { notFound } from "../utils/errors";

function tenantArticles(tenant: string): KbArticle[] {
  return store.kbArticles.filter((a) => a.tenantId === tenant);
}

export const knowledgeHandlers = [
  http.get("*/api/kb", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase().trim();
    const all = tenantArticles(tenant);
    const filtered = q
      ? all.filter(
          (a) => a.title.toLowerCase().includes(q) || (a.summary ?? "").toLowerCase().includes(q),
        )
      : all;
    return HttpResponse.json(paginate(filtered, readPageParams(url)));
  }),

  http.get("*/api/kb/categories", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const categories = store.kbCategories.filter((c) => c.tenantId === tenant);
    return HttpResponse.json({ categories });
  }),

  http.get("*/api/kb/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const found = tenantArticles(tenant).find((a) => a.id === id);
    if (!found) return notFound("kb article", id, correlationIdFrom(request));
    return HttpResponse.json(found);
  }),
];
