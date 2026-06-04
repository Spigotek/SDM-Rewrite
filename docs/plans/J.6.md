# J.6 — Calendar drag-resize (graduates H.10 editable: false)

> **Status**: 🔜 NEXT
> **Branch**: `chunk/J.6-calendar-drag-resize` > **Cieľ**: enable drag-and-drop + edge-resize on the `/changes/calendar` route by flipping
> `editable: true` in the FullCalendar config and wiring `eventDrop` + `eventResize` to a new
> BFF endpoint `PATCH /api/changes/:id/schedule`. Conflict detection runs client-side against
> the in-memory event set; user gets a confirm dialog when the drop overlaps another change
> in the same business window. Permission gate: `change.schedule`. No new runtime deps —
> `@fullcalendar/interaction` plugin already in the `vendor-calendar` chunk per H.10 baseline.

## Pivot vs ROADMAP

H.10 (PR #35) outcome explicitly notes: "drag-resize **disabled** per MVP — `editable: false`"
and the comment in `lib/full-calendar-config.ts` documents: "drag-resize is deferred to v1+
per H.10 plan §Open questions; we import the plugin but leave `editable` false so the drag
handles never render." J.6 closes that follow-up.

ROADMAP J.6 entry: "`@fullcalendar/interaction` plugin graduation (H.10 disabled `editable:
false`)."

Prompt §Open questions J.6: "Conflict resolution: drag onto another change → ask conflict
(per H.10 plan)."

## Inputs

- **`apps/workspace/src/features/changes/lib/full-calendar-config.ts`** — current
  `editable: false` site + plugin imports. J.6 flips `editable: true` + adds event-drop /
  resize options.
- **`apps/workspace/src/features/changes/components/CalendarView.tsx`** — owns the
  FullCalendar instance + ref. J.6 wires the drop / resize callbacks here.
- **`apps/workspace/src/features/changes/api.ts`** — TanStack Query factories for change
  list + detail. J.6 adds `updateChangeScheduleMutation`.
- **`apps/workspace/src/features/changes/ChangeCalendarRoute.tsx`** — owns the change-list
  query that feeds the calendar. J.6 invalidates this on mutation success.
- **`apps/bff/src/api/endpoints/changes.ts`** — existing POST endpoints for
  `/approve`/`/reject`/`/reminder`. J.6 adds a sibling PATCH handler.
- **`apps/bff/src/platform/audit/events.ts`** — frozen taxonomy. Audit composed under
  `data.chg.write` factory + `details.op="schedule.update"` discriminator.
- **`packages/domain/src/permissions.ts`** lines 81-99 — `change.schedule` permission already
  in taxonomy (verified 2026-06-04). Roles `change_manager` + `cab_approver` hold it.
- **`packages/api-mocks/src/handlers/changes.ts`** — MSW mirror for the PATCH endpoint.
- **`docs/agents/qa-test-strategy/acceptance-coverage.md`** — drag-resize row (if exists)
  graduated from "deferred"; otherwise add row.

## Outputs

```
apps/bff/src/api/endpoints/changes.ts               # MOD: + PATCH /api/changes/:id/schedule (zod-validated body { scheduledStartAt, scheduledEndAt })
apps/bff/tests/changes-schedule.test.ts             # NEW: 8+ cases (happy, permission gate, range validation, audit emit, missing fields, ISO format, end-before-start, not-found)

apps/workspace/src/features/changes/lib/full-calendar-config.ts  # MOD: editable: true; export onDrop/onResize types
apps/workspace/src/features/changes/components/CalendarView.tsx  # MOD: bind eventDrop + eventResize handlers; revert on error; conflict check
apps/workspace/src/features/changes/components/ConflictConfirmModal.tsx  # NEW: confirm dialog when drop overlaps another event in same business window
apps/workspace/src/features/changes/api.ts                       # MOD: + updateChangeScheduleMutation factory
apps/workspace/src/features/changes/hooks/useReschedule.ts       # NEW: hook composing the mutation + conflict-check + optimistic UI + revert

packages/api-mocks/src/handlers/changes.ts          # MOD: + PATCH /:id/schedule handler matching BFF shape

packages/i18n/catalogs/workspace/{sk,en}.json       # +5 keys: changes.calendar.reschedule.confirm / .conflictDetected / .conflictDescription / .error / .keepOriginal

tools/browser-test/scenarios/j6-calendar-drag-resize.spec.ts  # NEW: 3 cases (drag → PATCH succeeds → calendar updates; resize → end time updated; drop onto conflict → confirm dialog → cancel reverts position)

docs/agents/qa-test-strategy/acceptance-coverage.md # MOD: drag-resize row → pass
docs/CHANGELOG.md                                   # MOD: Known issues — "Advanced change-calendar interactions" entry struck through (drag-resize shipped; cross-tenant heavy overlay stays deferred)
docs/ROADMAP.md                                     # J.6 ⏳ → ✅ DONE
docs/plans/J.6.md                                   # Status NEXT → DONE; PR #
```

**No new runtime deps.** `@fullcalendar/interaction` already in `vendor-calendar` chunk.

## Done-when

- [ ] BFF `PATCH /api/changes/:id/schedule`: - Requires active session + `change.schedule` permission (403 otherwise). - Body validated by zod: `{ scheduledStartAt: ISO 8601, scheduledEndAt: ISO 8601 }`.
      Reject if `scheduledEndAt <= scheduledStartAt` (400 + `code: VALIDATION` +
      `details.field: "scheduledEndAt"`). - 404 if change ID not in tenant's queue. - Persists schedule changes (single-tenant: F.2 entity proxy PATCH `/chg/:id` with
      `scheduled_start` + `scheduled_end` fields per F.2 contracts; MSW mirror does in-memory
      flip). - Emits audit `data.chg.write` with `details.op="schedule.update"`,
      `details.scheduled_start_at`, `details.scheduled_end_at`,
      `details.previous_start_at`, `details.previous_end_at` (under frozen F.4 taxonomy). - Returns 200 + updated change DTO matching `ChangeRow` shape.
- [ ] FE calendar `editable: true` only when `change.schedule` permission held; otherwise
      `editable: false` (defence-in-depth client-side render gate).
- [ ] `eventDrop` handler: - Compute new `scheduledStartAt` + `scheduledEndAt` from FullCalendar event API. - Run client-side conflict check against `events[]` excluding the dragged event itself —
      overlap = `(other.start < new.end) && (other.end > new.start)`. - If conflict: open `<ConflictConfirmModal>` listing overlapping changes. On confirm →
      proceed with PATCH; on cancel → call `revert()` (FullCalendar drop event helper). - If no conflict: call PATCH directly. - On PATCH success: invalidate `changesListQuery` so the change list view reflects new
      times. - On PATCH failure: `revert()` + show error toast.
- [ ] `eventResize` handler: identical flow, but only `scheduledEndAt` typically changes
      (FullCalendar `start` may or may not move depending on which handle is dragged).
- [ ] BFF test coverage: ≥ 8 cases per Done-when matrix.
- [ ] Browser test `j6-calendar-drag-resize.spec.ts`: 3 specs.
- [ ] `pnpm i18n:check` green (+5 keys SK + EN).
- [ ] Bundle: workspace initial JS ≤ 350 KB gzip (calendar code stays in lazy
      `vendor-calendar` chunk; new modal is portal-rendered lightweight).
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` green.
- [ ] CI green: ci.yml + acceptance.yml + security.yml.

## Stratégia

### Fáza A — BFF PATCH endpoint

1. `apps/bff/src/api/endpoints/changes.ts` MOD — add:

   ```ts
   const ScheduleBody = z.object({
     scheduledStartAt: z.string().datetime(),
     scheduledEndAt: z.string().datetime(),
   }).refine((d) => new Date(d.scheduledEndAt) > new Date(d.scheduledStartAt), {
     message: "scheduledEndAt must be after scheduledStartAt",
     path: ["scheduledEndAt"],
   });

   app.patch("/api/changes/:id/schedule", async (c) => {
     const session = await requireActiveSession(c, deps);
     requirePermission(session, "change.schedule");
     const parsed = ScheduleBody.safeParse(await c.req.json().catch(() => ({})));
     if (!parsed.success) throw new AppErrorException({ code: "VALIDATION", httpStatus: 400, ... });
     const id = c.req.param("id");
     // Fetch current change (F.2 entity proxy GET /chg/:id), pull previous_start/end for audit.
     // Then PATCH F.2 entity proxy with the new fields.
     // Audit emit with details.op="schedule.update" + previous + new values.
     return c.json(updatedDto, 200);
   });
   ```

2. `apps/bff/tests/changes-schedule.test.ts` — 8 cases per Done-when.

### Fáza B — FE calendar wiring

1. `apps/workspace/src/features/changes/api.ts` — `updateChangeScheduleMutation(id)` factory
   returning a TanStack mutation that PATCHes `/api/changes/:id/schedule`.
2. `apps/workspace/src/features/changes/hooks/useReschedule.ts` — composes the mutation +
   `queryClient.invalidateQueries(["changes"])` on success.
3. `apps/workspace/src/features/changes/components/ConflictConfirmModal.tsx` — purpose-built
   confirm dialog (G.1 `<Card>` + `<Button>`). Lists overlapping change refs + summary.
4. `apps/workspace/src/features/changes/components/CalendarView.tsx` MOD:

   ```ts
   const canSchedule = hasPermission(roles, "change.schedule");
   const options = useMemo(() => ({
     ...baseOptions,
     editable: canSchedule,
     eventDrop: (info) => handleEventChange(info, "drop"),
     eventResize: (info) => handleEventChange(info, "resize"),
   }), [canSchedule, ...]);

   function handleEventChange(info: EventChangeArg, kind: "drop" | "resize") {
     const newStart = info.event.start;
     const newEnd = info.event.end ?? new Date(newStart.getTime() + DEFAULT_DURATION_MS);
     const conflicts = detectConflicts(allEvents, info.event.id, newStart, newEnd);
     if (conflicts.length > 0) {
       openConflictModal({
         conflicts,
         onConfirm: () => submitReschedule(info, newStart, newEnd),
         onCancel: () => info.revert(),
       });
     } else {
       submitReschedule(info, newStart, newEnd);
     }
   }
   ```

5. `apps/workspace/src/features/changes/lib/full-calendar-config.ts` — narrow comment from
   "drag-resize is deferred" to "drag-resize enabled when caller has change.schedule
   permission (J.6)".

### Fáza C — MSW + i18n

1. `packages/api-mocks/src/handlers/changes.ts` MOD — add PATCH `/api/changes/:id/schedule`
   handler. Updates in-memory fixture; returns updated DTO.
2. `packages/i18n/catalogs/workspace/{sk,en}.json` +5 keys:
   - `changes.calendar.reschedule.confirm` — "Reschedule"
   - `changes.calendar.reschedule.conflictDetected` — "Conflict detected"
   - `changes.calendar.reschedule.conflictDescription` — "{count, plural, one {1 zmena prekrýva nový čas} few {{count} zmeny prekrývajú nový čas} other {{count} zmien prekrýva nový čas}}"
   - `changes.calendar.reschedule.error` — "Reschedule failed — change reverted"
   - `changes.calendar.reschedule.keepOriginal` — "Keep original"

### Fáza D — Tests + docs

1. BFF tests: `changes-schedule.test.ts` 8 cases.
2. Browser test `j6-calendar-drag-resize.spec.ts` 3 specs.
3. CHANGELOG: strike through "Advanced change-calendar interactions" entry for drag-resize
   (cross-tenant heavy overlay stays deferred — different scope).
4. PR `feat(changes): drag-resize on change calendar (J.6)`.
5. Subagent reports, does NOT merge. Parent merges.

### Fáza E — Post-merge

ROADMAP J.6 toggle + commit.

## Open questions / risks — recommended resolutions

- **Permission key — `change.schedule` vs `change.update.plan`** — taxonomy has both. **Rec**:
  `change.schedule` (semantically tighter for "reschedule"; `change.update.plan` is broader
  including plan/rollback/impact). Verify in `permissions.ts` E.2 baseline.
- **Conflict detection scope** — overlap is computed only against events currently rendered
  in the calendar view. If the calendar is filtered (e.g. only HIGH-risk), conflicts with
  filtered-out changes are missed. **Rec**: accept this as MVP (matches H.10 baseline; full
  cross-filter detection = v2.0 with BFF-side conflict query). Document in conflict modal
  body that "this check considers visible changes only".
- **Permission boundaries on drag from blacklist** — if a user has `change.schedule` for
  their tenant but a change row from another tenant appears (sp_admin overlay), drag-resize
  must be disabled for foreign-tenant rows. **Rec**: client-side check `event.extendedProps.tenantId === session.activeTenantId` before allowing drop; FullCalendar's `editable` per-event override.
- **Optimistic UI vs reverse-then-commit** — FullCalendar by default applies the drop
  visually then calls the callback (optimistic). We call PATCH and on failure call
  `info.revert()` to roll back. **Rec**: stick with this default; document UX expectation
  (brief visual update then revert on failure).
- **End-before-start guard** — server enforces via zod refinement; client should pre-check
  too to avoid the round-trip. **Rec**: add a client guard with a toast — if user resizes so
  end <= start (FullCalendar tolerates this), toast immediately and revert.
- **Browser test stability** — drag-and-drop in Playwright is sometimes flaky. **Rec**: use
  Playwright `dragTo` with explicit source/target coords + retry once on `TimeoutError`.
  Subagent should pin frame-by-frame timing if flake surfaces.
- **Audit `previous_*` values** — fetching current change before PATCH adds one BFF read.
  **Rec**: accept the round-trip; audit completeness requires before/after. Cache hit on the
  F.2 entity proxy makes this cheap.

## Notes pre subagenta

- **Subagent NESMIE**:
  - Add a new audit event name. Compose under `data.chg.write` factory + `details.op` only.
  - Add a new runtime dep. `@fullcalendar/interaction` is already imported per
    `apps/workspace/src/features/changes/lib/full-calendar-config.ts`.
  - Change the `editable: false` site without also flipping it per-user permission.
  - Touch cross-tenant overlay logic (I.5 / J.2 surface — unrelated to drag-resize).
  - Add real-time conflict push (J.3 SSE is for tenant suspension only; reusing it for
    change conflicts is v2.0 scope).
  - Mergovať vlastný PR.
- **Subagent musí**:
  - Use `change.schedule` permission (not `change.update.plan`) — verify in `permissions.ts`.
  - Pre-fetch the current change inside the PATCH handler to capture
    `previous_start_at`/`previous_end_at` for audit completeness.
  - Implement zod end-after-start refinement on the BFF body + client-side mirror guard.
  - Use FullCalendar's `info.revert()` on PATCH failure; never leave the UI in a desynced
    state.
  - Single squash-friendly PR commit `feat(changes): drag-resize on change calendar (J.6)`.
- **READ FIRST** (subagent should read these before editing):
  - `docs/plans/J.6.md` (this file) end-to-end
  - `apps/workspace/src/features/changes/lib/full-calendar-config.ts` (current `editable: false` site + plugin comment)
  - `apps/workspace/src/features/changes/components/CalendarView.tsx` (FullCalendar ref + options usage)
  - `apps/bff/src/api/endpoints/changes.ts` (existing CAB endpoints — POST `/approve` etc. — recent pattern with audit emit + permission gate)
  - `apps/bff/src/api/endpoints/admin-tenants.ts` from J.3 (cleanest example of `details.op` discriminator audit emit)
  - `packages/domain/src/permissions.ts` lines 75-100 (change.\* permissions taxonomy)
  - `apps/bff/src/platform/audit/events.ts` (frozen taxonomy)
  - `docs/plans/H.10.md` Open questions §conflict (the original v1+ deferral note)
  - `docs/plans/H.11.md` (recent CAB approval flow — similar PR shape)
