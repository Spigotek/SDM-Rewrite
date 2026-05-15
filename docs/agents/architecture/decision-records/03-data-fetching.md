# ADR-03 — Data fetching layer

**Status**: accepted (potvrdené v r2 zhodou s 06)
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1+2)

## Changelog (round 2)

- 06 v `tech-stack-selector/libraries.md` nezávisle zvolil **TanStack Query v5**
  s React bindingom — zhoda s týmto ADR.
- Framework binding flag `[resolved-in-round-2]` — `@tanstack/react-query`.
- Doplnená poznámka o spolupráci s ADR-11 (per-tenant cache keys cez QueryKey
  prefix) — zhoda s `security/multi-tenancy-security.md` L2 mitigáciou.

## Kontext

SPA (Portal aj Workspace) potrebujú vrstvu pre:
- Fetching dát z BFF (`/api/queue`, `/api/tickets/...`, `/api/kb/...`, `/me`,
  reference data).
- Server-state cache s TTL + invalidation triggers (definované per UI view
  v 03/`ui-views.md` — `UiQueueItem` 30 s, `UiTicketDetail` 60 s, atď.).
- Mutations s optimistic update (status change, assignee change, reply
  composer).
- Background refetch + stale-while-revalidate UX.
- Request deduplication (dva komponenty volajú ten istý endpoint → jeden
  request).
- Loading / error states bez boilerplate.

UX agent identifikoval polling-based real-time stratégiu (R-012, MVP: 30 s
polling pre queue, 10 s pre ticket detail activity log).

## Rozhodnutie

**TanStack Query** (`@tanstack/react-query` v React kontexte; ekvivalentné
adaptéry pre Vue/Angular/Solid ak Tech Stack zvolí iný framework).

Použitie:
- `useQuery(['queue', filters])` — server-state cache, refetch on mount /
  on window focus / interval.
- `useMutation(...)` — write operations s `onMutate` optimistic update
  + `onError` rollback + `onSettled` invalidateQueries.
- `QueryClient` global instance s default options:
  ```ts
  staleTime: 30_000,          // default; per-query override
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: (failureCount, error) => {
    if (error.code === "AUTH_EXPIRED") return false; // skip retry, redirect login
    return failureCount < 2;
  }
  ```

## Dôsledky

**Pozitívne**:
1. **Server-state správny model** — TanStack Query rieši cache, deduplication,
   refetch, background sync. Bez nej by sme to museli rebuild-ovať.
2. **Optimistic updates** sú first-class — Anna stlačí "c" (close), UI hneď
   ukáže ticket ako closed, ak BFF zlyhá → rollback + toast.
3. **Žiadny global store** — server-state je v QueryClient cache, nie v
   Redux/Zustand. SoC: server-state vs. client-state.
4. **Dev tools** — `@tanstack/react-query-devtools` na vizualizáciu cache
   state počas dev.
5. **Framework-agnostic** — má React, Vue, Angular, Solid bindings. Tech
   Stack môže zvoliť framework bez vplyvu na túto vrstvu.
6. **Selektívna invalidation** — `queryClient.invalidateQueries({ queryKey: ['tickets', id] })`
   po update precízne — bez full-cache flush.
7. **Široká adopcia** — de-facto štandard 2024+ pre server-state v React/Vue.

**Negatívne**:
1. **+1 dependency** (~ 13 kB gzipped pre core). Mitigácia: TanStack Query
   je tree-shakeable, využijú obe SPA tieto bytes.
2. **Učebná krivka** — query keys, staleTime vs. gcTime, optimistic patterns.
   Mitigácia: dev handbook od 10 Documentation Author + tréning.
3. **Pri tenant switch musíme `clear()` cache** — riziko race conditions
   ak existujú in-flight requests. Mitigácia: `queryClient.cancelQueries()`
   pred `clear()`. Detail v `data-flows.md` § Tenant switch.

## Alternatívy

### A) RTK Query (Redux Toolkit Query)

**Prečo zamietnuté**:
- Vyžaduje Redux. Pridáva globálny store (P4 — žiadny globálny store) — je
  to nepotrebná abstrakcia pre náš scope.
- Code-generator z OpenAPI schémy je pekný, ale my generujeme `@sdm/api-types`
  z `domain/model.ts` (jediný zdroj pravdy v MVP, kým API analyst nedoručí
  schémy v round 2).
- TanStack Query má v praxi ergonomickejšie API pre náš use case
  (multi-feature parallel queries, fine-grained invalidation).

### B) SWR (Vercel)

**Prečo zamietnuté**:
- TanStack Query a SWR sú feature-comparable; ale TanStack Query má lepšie
  mutation API + dev tools + dokumentáciu.
- SWR má svoj history v React-only. TanStack Query má framework-agnostic
  bindings, čo nám dáva flexibilitu pre 06 Tech Stack.

### C) Apollo Client

**Prečo zamietnuté**:
- Apollo je GraphQL klient. CA SDM nemá GraphQL endpoint a my nechystáme
  GraphQL BFF (REST stačí).
- Apollo over REST (`apollo-link-rest`) je nepoužívané, fragmentárne
  dokumentované.

### D) Vlastný `fetch` wrapper + React Context cache

**Prečo zamietnuté**:
- Reinvented wheel. Cache invalidation, deduplication, stale-while-revalidate
  by sme implementovali horšie a buggier ako TanStack Query.
- Žiadne dev tools.
- Žiadne mutation patterns out-of-the-box.

### E) Žiadna cache (každý komponent fetchne čo potrebuje)

**Prečo zamietnuté**:
- N+1 requests, terrible UX, latencia bije TTI cieľ.
- Nemožné dosiahnuť TTL freshness contracts z 03/`ui-views.md`.

## Otvorené závislosti

| # | Flag | Smer | Popis | Status |
|---|---|---|---|---|
| 1 | `framework-binding` | (vlastné) | `@tanstack/react-query` (React 19). | `[resolved-in-round-2]` — 06 potvrdil React 19. |
| 2 | `query-key-conventions` | → 08-devex-devops | Dev handbook konvencia `['<tenant>', '<resource>', ...keys]`. Tenant prefix kvôli L2 mitigácii. | open (handbook task) |
| 3 | `optimistic-update-policy` | → 09-qa | Per-mutation policy. QA agent (09) v `acceptance-criteria.md` má 18 journey scenárov — bude finalizovať. | open (vlastní 09) |
