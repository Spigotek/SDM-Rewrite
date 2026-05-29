# I.1 — Step-up 2FA + emergency approve + RHF Controller race fix

> **Status**: 🔜 (blokované na I.0 merge)
> **Branch**: `chunk/I.1-step-up-emergency` > **PR**: TBD
> **Cieľ**: implementovať F.1 step-up 2FA flow (documented but never built),
> wire-up emergency approve modal v H.11 ApproveModal (production env + risk_tier
> critical triggers step-up), fix journey-02 portal request submit RHF Controller
> race v preview-build mode, fix journey-09 required-field close block.
> Closes 2 partials (journey #2, #11) + 1 cross-cutting (C9 silent re-auth).

## Pivot vs ROADMAP

H.16 coverage matrix: journey-11 (workspace-change-emergency-approve) partial
— step-up 2FA `@security:step-up-totp` + `@security:audit-log-step-up`
**not implemented in MVP**. journey-02 partial — RHF Controller race. journey-09
partial — required-field close block deferred.

H.11 plan §Open questions: "Step-up auth: F.1 documented step-up but may not
implement. If unavailable, ship without (degraded UX) + open issue for Phase I
(security audit)." — I.1 zatvára.

## Inputs

- **`docs/agents/security/auth-flow.md` §step-up** — autoritatívny step-up flow design.
- **`apps/bff/src/auth/`** — F.1 baseline (session, /auth/\*, /me); step-up handler chýba.
- **`apps/workspace/src/features/changes/components/ApproveModal.tsx`** — H.11 baseline; needs step-up gate pre risk_tier=critical AND env=production.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §4.3** — step-up security vectors.
- **`apps/portal/src/features/catalog/components/FieldRenderer.tsx`** — journey-02 RHF Controller race source. Investigate radio render path.
- **`tools/browser-test/scenarios/acceptance/journey-02-portal-request-software.spec.ts`** — current partial state (form-render only assertion). Restore full submit roundtrip.
- **`apps/workspace/src/features/tickets/components/ResolveModal.tsx`** — journey-09 required-field block needs Zod refinement (Solution + Category required when status → CL).

## Outputs

```
apps/bff/src/auth/step-up.ts                       # NEW: POST /auth/step-up { totp } → mint step-up token (15 min validity)
apps/bff/src/auth/step-up-token.ts                 # NEW: in-memory step-up token store
apps/bff/tests/step-up.test.ts                     # NEW: 6+ cases (happy + invalid TOTP + expired + replay + audit emit)

apps/bff/src/api/endpoints/changes.ts              # MOD: /approve handler checks step-up token header for critical+prod
apps/workspace/src/features/changes/components/StepUpModal.tsx   # NEW: TOTP input + verify flow
apps/workspace/src/features/changes/components/ApproveModal.tsx  # MOD: trigger step-up gate when risk_tier=critical + env=production
apps/workspace/src/features/changes/api.ts         # MOD: postApprove() prepends step-up header

apps/portal/src/features/catalog/components/FieldRenderer.tsx    # FIX: RHF Controller race for radio field (force re-render after value change)
apps/portal/src/features/catalog/CatalogItemRoute.tsx            # FIX: ensure submit handler waits for form state settled

apps/workspace/src/features/tickets/components/ResolveModal.tsx  # MOD: Zod refinement requires Solution + Category when status → CL

tools/browser-test/scenarios/acceptance/journey-02-portal-request-software.spec.ts   # RESTORE: full submit roundtrip assertion
tools/browser-test/scenarios/acceptance/journey-11-workspace-change-emergency.spec.ts # RESTORE: step-up TOTP + audit emit
tools/browser-test/scenarios/acceptance/journey-09-workspace-incident-deepdive.spec.ts # RESTORE: required-field close block

packages/i18n/catalogs/workspace/{sk,en}.json      # +stepUp.* keys (~10)
packages/i18n/catalogs/shared/{sk,en}.json         # +session.silentRefresh.* keys (~3)

docs/agents/qa-test-strategy/acceptance-coverage.md # UPDATE: journeys #2/#9/#11 partial → pass
docs/ROADMAP.md                                     # I.1 → ✅ DONE
docs/plans/I.1.md                                   # Status DONE
```

## Done-when

- [ ] `POST /auth/step-up { totp }` v BFF — validates TOTP proti session-bound seed (test seed v MSW; real seed za Phase I.6 production cut). Returns `{ stepUpToken, expiresAt }` (15 min). Emits `authn.step_up.success` / `authn.step_up.denied` audit (composed under existing `authn.*` taxonomy — žiadne nové event names).
- [ ] `POST /api/changes/:id/approve` v BFF detects `risk_tier=critical` + `tenant.environment=production` → requires `X-Step-Up-Token` header. Missing/invalid token → 401 + audit `data.chg.write` s `details.op=cab.approve.denied_step_up`.
- [ ] `<StepUpModal>` UI: TOTP 6-digit input + verify button → POST /auth/step-up → on success caller modal (`ApproveModal`) auto-submits with step-up token.
- [ ] `<ApproveModal>` reads `change.risk_tier` + `tenant.environment` z context; if both critical+prod, opens `<StepUpModal>` before submit. Otherwise direct submit (existing flow).
- [ ] Journey-02 (`portal-request-software`) full submit roundtrip green v preview-build mode. RHF Controller race fix v `FieldRenderer.tsx` (likely `setTimeout(submitHandler, 0)` alebo `await form.trigger()` pred submit).
- [ ] Journey-09 (`workspace-incident-deep-dive`) required-field close block green — ResolveModal blokuje submit ak status → CL + Solution OR Category empty.
- [ ] Journey-11 (`workspace-change-emergency-approve`) full flow green — open emergency change → Approve → StepUpModal opens → enter TOTP → submit → audit emitted.
- [ ] `acceptance-coverage.md`: journeys #2, #9, #11 status `partial` → `pass`.
- [ ] `pnpm i18n:check` green (+stepUp._ + session.silentRefresh._ keys).
- [ ] CI all green vrátane `acceptance.yml` workflow.

## Stratégia

### Fáza A — BFF step-up endpoint

1. `apps/bff/src/auth/step-up-token.ts`:
   ```ts
   const tokens = new Map<string, { sessionId: string; expiresAt: number }>();
   export function mintStepUpToken(sessionId: string): { token: string; expiresAt: number } { ... }
   export function consumeStepUpToken(token: string, sessionId: string): boolean { ... }  // single-use OR within 15min window
   ```
2. `apps/bff/src/auth/step-up.ts`:
   - `POST /auth/step-up { totp: string }`.
   - Validate TOTP cez `node:crypto` HOTP/TOTP (RFC 6238): seed je per-user, dev seed v MSW/test fixtures.
   - Mint token + return.
   - Emit audit.
3. Tests: happy, invalid TOTP, expired session, replay attack, audit emit shape, concurrent requests.

### Fáza B — FE step-up flow + emergency approve gate

1. `<StepUpModal>` z scratch (NIE z `<ConfirmDialog>` reuse, custom flow):
   - TextField TOTP `inputMode="numeric"` `maxLength={6}` `autoComplete="one-time-code"`.
   - Submit → `POST /auth/step-up` → on 200 callback `onSuccess(token)`.
2. `<ApproveModal>` modification: ak `change.risk_tier === "critical" && tenant.environment === "production"`:
   ```tsx
   const [stepUpToken, setStepUpToken] = useState<string | null>(null);
   if (!stepUpToken) return <StepUpModal onSuccess={setStepUpToken} />;
   // pass token to mutation
   ```
3. `useApproveChange` hook prepends `X-Step-Up-Token` header keď k dispozícii.

### Fáza C — Journey #2/#9 fixes + tests + PR

1. Investigate journey-02 RHF Controller race:
   - Repro: `pnpm --filter @sdm/portal build && pnpm --filter @sdm/portal preview` → navigate `/catalog/item-1` → fill form → submit. Watch console for warnings, RHF state.
   - Likely cause: native radio change event triggers re-render before `handleSubmit` reads value. Fix: wrap radio input v Controller render with `setValue("priority", value, { shouldValidate: true })` instead of direct register.
2. Journey-09 ResolveModal Zod refinement:
   ```ts
   const resolveSchema = z.object({...}).refine((data) => {
     if (data.status === "CL") return !!data.solution && !!data.category;
     return true;
   }, { message: "...", path: ["solution"] });
   ```
3. Update browser tests pre journey-02/09/11 — restore full assertions.
4. Update `acceptance-coverage.md` matrix.

## Open questions / risks — recommended resolutions

- **TOTP seed source**: production = OIDC provider's TOTP backend (Keycloak / Azure AD); dev = hardcoded seed per user v MSW (`JBSWY3DPEHPK3PXP` standard test seed). Test fixtures use deterministic TOTP per session. **Recommendation**: I.1 ships dev mode (MSW seed), I.6 release dry-run validates real OIDC step-up.
- **Token storage**: in-memory `Map` per BFF instance — same constraint ako session store (F.1). Multi-instance deployments treba Redis or sticky session — out of MVP scope (per F.1 pattern).
- **Replay protection**: token je single-use (consumed on first approve) OR 15-min sliding window? Recommendation: **single-use** per OWASP step-up best practice. Concurrent approvals s same token → second 401.
- **Re-auth modal trigger**: pri session expiry (401 from any mutation), modal otvorí cez existing `@sdm/api-client` 401 handler. I.1 wire-uje to len ak existing handler doesn't already — likely H.1 PendingChangesContext patterns sufficient.
- **RHF Controller race scope**: ak fix v FieldRenderer odhalí širšie issues v H.5 DynamicForm, escalate as scope creep + report; **NIE** rewriting whole form layer.

## Notes pre subagenta

- Reuse G.1 `<TextField>`, `<ConfirmDialog>` patterns; new `<StepUpModal>` je purpose-specific.
- TOTP implementation: `node:crypto` natívny, NIE external deps (per D3 — no `speakeasy`).
- Subagent **NESMIE**:
  - Pridať OIDC step-up handshake (out of MVP — real OIDC step-up je production-only).
  - Refactor existing H.11 ApproveModal beyond step-up gate addition.
  - Mergovať vlastný PR.
