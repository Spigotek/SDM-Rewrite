# H.1 — Tenant switcher activation + permission cache invalidation

> **Status**: 🔜 NEXT (blokované na H.0 merge)
> **Branch**: `chunk/H.1-tenant-switch` (od fresh `main` po H.0 merge)
> **PR**: TBD
> **Cieľ**: aktivovať plne funkčný tenant switcher v oboch SPA — UI dropdown
> (P0 wireframe `shared/tenant-switcher.md`) → BFF `POST /me/active-tenant`
> → server-side session update → FE TanStack Query cache invalidation
> (tenant-scoped queryKey) → `effectivePermissions[]` refresh → re-render
> permission-gated UI. Includes pending-changes guard (confirm dialog ak má
> user otvorený rozpísaný form pri switch).

## Pivot vs ROADMAP

ROADMAP Multi-tenancy row: `tenant-switcher` v oboch app-och. E.3 vystavil
stub komponent + localStorage-driven tenant; F.5 zarovnal `/me` na canonical
shape s `activeTenantId` + `effectivePermissions[]`. H.1 zatvára kruh:
**BFF round-trip** + cache invalidation + UX safety net.

## Inputs

- **`docs/spec/multi-tenancy.md` §5.4 (tenant switch sequence)** — autoritatívny BFF flow: `POST /me/active-tenant {tenantId}` → BFF validates permission → updates session `activeTenantId` → returns updated session shape s permissions; FE invaliduje cache.
- **`docs/spec/multi-tenancy.md` §6 (UI tenant switcher)** — UI requirements (dropdown, env badge, search v >10 tenants).
- **`docs/agents/ux-persona-analyst/wireframes/shared/tenant-switcher.md`** — vizuálny + interakcia spec (variants compact/expanded/single, kbd shortcut `T`, env badge per high-risk tenant).
- **`docs/agents/security/audit-and-compliance.md` §2 authz.tenant.switch.{success,denied}** — F.4 audit events; H.1 ich emit-uje server-side (BFF) pri switch.
- **`apps/{portal,workspace}/src/shell/tenant-switcher.tsx`** — E.3 stub s localStorage; H.1 rewire na BFF.
- **`apps/bff/src/auth/`** — existing `/me/active-tenant` endpoint per F.1 (PUT/POST). Re-overiť shape, augment ak treba.
- **`packages/auth/src/session.ts`** — `Session.activeTenantId`, `Session.tenants[]`, `Session.effectivePermissions[]` shape; tenant switch updatuje tieto fields.
- **`packages/api-client/src/`** — HttpClient používa `X-CA-SDM-Tenant` header per F.1; H.1 ho **odstraňuje** (tenant je server-side z session, žiadny client-side header injection per F.5 cleanup).
- **`apps/bff/src/platform/audit/events.ts`** — `authz.TENANT_SWITCH_SUCCESS / TENANT_SWITCH_DENIED` event names.

## Outputs

```
apps/bff/src/auth/active-tenant.ts            # MOD/NEW — POST /me/active-tenant handler with audit emit
apps/bff/src/auth/index.ts                    # registerActiveTenantRoute
apps/bff/tests/active-tenant.test.ts          # NEW — unit + integration tests

apps/portal/src/shell/tenant-switcher.tsx     # REWIRE — Radix DropdownMenu + Combobox search + env badge
apps/workspace/src/shell/tenant-switcher.tsx  # identicky

apps/portal/src/features/tenants/             # NEW
├── api.ts                                    # postActiveTenant(tenantId) → updated session
├── hooks.ts                                  # useActiveTenant() (TQ mutation + cache invalidation)
└── types.ts
apps/workspace/src/features/tenants/          # identicky

apps/{portal,workspace}/src/shell/session-context.tsx  # MOD — re-read /me on activeTenantId change
apps/{portal,workspace}/src/shell/pending-changes.ts   # NEW — minimal "is form dirty" context hook (used by guard)

packages/api-client/src/http.ts               # REMOVE: X-CA-SDM-Tenant header injection (server-side now)

packages/i18n/catalogs/shared/{sk,en}.json    # +tenantSwitcher.* keys (search, current, switchTo, pendingChangesConfirm, etc.)
packages/i18n/catalogs/{portal,workspace}/{sk,en}.json  # +tenant-switch-related strings if app-specific

tools/browser-test/scenarios/h1-tenant-switch.spec.ts  # NEW — full E2E
tools/browser-test/scenarios/h1-pending-changes-guard.spec.ts  # NEW — confirm dialog

docs/ROADMAP.md
docs/plans/H.1.md
```

## Done-when

- [ ] `POST /me/active-tenant {tenantId}` v BFF — validates user has `effectivePermissions[]` v target tenante, updates session shape, emits `authz.tenant.switch.success` audit event. Reject (403) ak user nemá rolu v target tenante → emits `authz.tenant.switch.denied`.
- [ ] FE `useActiveTenant()` hook — TanStack Query mutation. On success: `queryClient.removeQueries({ queryKey: [/* all tenant-scoped keys */] })` + refetch `/me` query. On error: toast error + revert UI to previous tenant.
- [ ] TenantSwitcher UI variants per wireframe:
  - `single` (read-only display) — when user má len 1 tenant
  - `compact` — top-bar collapsed, shows current tenant name + env badge
  - `expanded` — dropdown opens on click, shows search input + tenants list (env badges, current marker)
- [ ] **Pending-changes guard**: ak má user dirty form (capture via `pending-changes.ts` context — Composer, NewIncidentForm, etc. registrujú dirty state), tenant switch otvorí `<ConfirmDialog>` per `microcopy.md §6` "Prepnúť tenant? Máš otvorený nezapísaný formulár — Prepnutie ho uzavrie."
- [ ] **Keyboard shortcut**: `T` keyboard opens tenant switcher dropdown (per wireframe). Documented v `?` overlay (placeholder, no functional cheat sheet v H.1).
- [ ] Env badge per `tokens.md §4 Tenant environment color` — `production`/`staging`/`development`/`sandbox` shown next to tenant name v dropdown.
- [ ] `X-CA-SDM-Tenant` client-side header **odstránený** z `@sdm/api-client`. BFF resolves tenant from session.
- [ ] Browser test scenarios:
  - `h1-tenant-switch.spec.ts`: login as multi-tenant user → switch from Acme to Globex → verify queue refetches with new data → verify URL preserved.
  - `h1-pending-changes-guard.spec.ts`: open new-incident form → type into field → click tenant switch → confirm dialog appears → "Cancel" preserves form, "Switch" discards.
- [ ] Audit: tenant switch emit-uje `authz.tenant.switch.success` s `details: { fromTenantId, toTenantId }` v BFF pino log.
- [ ] `pnpm i18n:check` green (parity SK ↔ EN for new tenant keys).
- [ ] `pnpm -r typecheck/lint/test/build` green.
- [ ] ROADMAP toggle: H.1 → ✅ DONE.

## Stratégia

### Fáza A — BFF endpoint

1. `apps/bff/src/auth/active-tenant.ts`:
   - `POST /me/active-tenant { tenantId: string }` handler.
   - Validate session loaded; check `session.tenants.some(t => t.id === tenantId)`. Ak nie → 403 + audit `denied`.
   - Mutate session: `session.activeTenantId = tenantId`, recompute `effectivePermissions[]` from `session.tenants.find(...).roles[].permissions`.
   - Persist session via `sessionStore.update(sid, session)`.
   - Emit `authz.tenant.switch.success` audit event s `details: { fromTenantId, toTenantId }`.
   - Return updated `Session` shape (matches `/me`).
2. `apps/bff/tests/active-tenant.test.ts`: unit + integration (4-6 cases: happy path, 403 unknown tenant, 401 no session, audit event emit, idempotent same-tenant switch).

### Fáza B — FE TenantSwitcher rewire

1. `apps/portal/src/features/tenants/api.ts`:
   ```ts
   export async function postActiveTenant(tenantId: string): Promise<Session> {
     return httpClient.post("/me/active-tenant", { tenantId });
   }
   ```
2. `apps/portal/src/features/tenants/hooks.ts`:
   ```ts
   export function useActiveTenant() {
     const queryClient = useQueryClient();
     const { mutate } = useMutation({
       mutationFn: postActiveTenant,
       onSuccess: (newSession) => {
         queryClient.setQueryData(["me"], newSession);
         // Invalidate all tenant-scoped queries — broad nuke per ADR-04 r2
         queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
       },
       onError: (err) => toast.error(t("tenantSwitcher.error")),
     });
     return mutate;
   }
   ```
3. `apps/portal/src/shell/tenant-switcher.tsx` rewrite:
   - Read tenants from `useSession()` context (existing E.3).
   - Render variant logic per wireframe.
   - On select: check `usePendingChanges().hasDirtyForms` — if true, open ConfirmDialog; else call `useActiveTenant()`.
   - Env badge: `<TenantEnvBadge env={tenant.environment} />` (existing in `@sdm/design-system` po G.1).
4. `apps/portal/src/shell/pending-changes.ts`:
   ```ts
   const PendingChangesContext = createContext<{
     dirtyForms: Set<string>;
     register: (formId: string) => () => void;
   }>(...);
   export function PendingChangesProvider({ children }) { /* ... */ }
   export function usePendingChanges() { return useContext(PendingChangesContext); }
   ```
   Forms call `useEffect(() => register(formId), [])` when dirty; cleanup on unmount/submit.
5. Wire `<PendingChangesProvider>` v `<AppShell>` (above `<Outlet />`).
6. Workspace identicky.

### Fáza C — i18n + header removal + tests + PR

1. Add to `packages/i18n/catalogs/shared/{sk,en}.json`:
   ```json
   "tenantSwitcher": {
     "label": "Tenant",
     "current": "Aktívny tenant",
     "search": "Hľadať tenant…",
     "switchTo": "Prepnúť na {name}",
     "pendingChangesTitle": "Prepnúť tenant?",
     "pendingChangesBody": "Máš otvorený rozpísaný formulár. Prepnutie ho uzavrie.",
     "pendingChangesConfirm": "Prepnúť",
     "error": "Prepnutie sa nepodarilo. Skús to znova."
   }
   ```
2. `packages/api-client/src/http.ts`: remove `X-CA-SDM-Tenant` header logic. Update `http.test.ts`.
3. Browser tests run against `VITE_USE_MOCKS=true` mode — MSW handlers musia mať `/me/active-tenant` POST handler s tenant validation logic. Verify `packages/api-mocks/src/handlers/users.ts` má relevant handler; ak nie, doplniť.
4. `pnpm -r typecheck/lint/test/build` green + new browser tests pass; PR per memory.

## Open questions / risks — recommended resolutions

- **TanStack Query cache invalidation strategy**: broad nuke (`removeQueries` for non-`me` keys) — simple, correct, slightly costlier than surgical invalidation. ADR-04 r2 preferred broad approach. Live ticket cache cold post-switch — acceptable UX cost for tenant safety.
- **Pending-changes "dirty form" detection**: minimal MVP — Form components (RHF) register `formId` v context when `formState.isDirty === true`. Cleanup on unmount. Future work: Composer drafts (auto-saved) shouldn't trigger guard.
- **Keyboard shortcut `T`**: react-hotkeys-hook globally listens for `T` key when no input focused. Dropdown opens, search input auto-focuses.
- **`X-CA-SDM-Tenant` removal**: F.5 cleanup intended this; H.1 finalizes. Confirm BFF doesn't rely on incoming header — should already be true post-F.5 (verify per `apps/bff/src/api/tenant-scoping.ts`).
- **Single-tenant user**: `single` variant — read-only display, no dropdown. Listed v MSW handler users (`vueuser` is multi-tenant; some test users single-tenant).
- **Service Provider impersonation** (sp_admin reading cross-tenant): out of H.1 scope. Per spec/multi-tenancy.md §SP_ADMIN — covered by Phase I.3 multi-tenancy edge cases.
- **High-risk env warning**: production tenant switch shows env badge in red (per `tokens.md §4 color.env.production = #DC2626`). No additional confirm dialog beyond pending-changes.
- **MSW handler shape**: existing `/me/active-tenant` handler v `users.ts` (E.1) je placeholder. H.1 musí overiť že updates `activeTenantId` v mock session + returns canonical shape per F.5.

## Notes pre subagenta

- Subagent dispatched s self-contained brief obsahujúcim:
  - **BFF endpoint already exists** za F.1 — overiť shape + augment ak treba (audit emit může chýbať).
  - **`X-CA-SDM-Tenant` header REMOVAL** je súčasť this chunk — žiadny client-side tenant injection.
  - **TanStack Query nuke approach** — broad invalidation (queryKey[0] !== "me"). Surgical invalidation je v1+ optimization.
  - **Pending-changes context** je minimal MVP — len boolean dirty flag, no full state save.
- Subagent **NESMIE**:
  - Pridať Service Provider impersonation features (out of MVP).
  - Implementovať form auto-save (draft persistence) — Phase H feature work, NIE H.1.
  - Pridať tenant onboarding UI (new tenant creation) — NIE MVP scope.
  - Mergovať vlastný PR.
