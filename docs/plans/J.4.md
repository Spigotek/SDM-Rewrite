# J.4 — KB analytics real ingest (replaces I.4 MSW fixture)

> **Status**: ✅ N/A — closed without code change. Implementing the J.md skeleton intent would
> require either (a) expanding F.4 frozen audit taxonomy with `data.kb.read` + `data.kb.search`
> action verbs (explicitly banned by Phase J Hard rules) or (b) standing up a purpose-built
> telemetry channel that on the current deploy posture (no production traffic; J.0 cluster
> deferred; CA SDM has no native KB analytics surface) would collect no signal. Same pattern
> as J.2 — chunk closes as N/A.
> **Branch**: none (docs-only closure on `main`).
> **Outcome**: pre-flight inventory of existing KB audit emissions returned **zero** —
> `data.kb.read` and `data.kb.search` are not currently emitted anywhere in the BFF. Any
> "graduation from MSW fixture to real ingest" requires both the emission path and the
> aggregation, neither of which has a usable signal source on the dev/test instance.

## Cieľ (had it been actionable)

J.md / ROADMAP J.4 entry: "audit-log-derived aggregation in BFF (data.kb.read / data.kb.search
events from F.4 taxonomy); replaces I.4 MSW fixture. No CA SDM schema changes."

The intent was to swap `apps/bff/src/api/endpoints/kb-analytics.ts` `fixtureSnapshot(range)`
return path for an aggregation over audit-log entries (`data.kb.read` per article view,
`data.kb.search` per search) so the workspace `/kb/analytics` dashboard shows live data.

## Pre-flight inventory (2026-06-04)

```
grep -rn 'data\.kb\.\|kb\.read\|kb\.search' apps/bff/src/api/endpoints/
→ 0 matches
```

KB read endpoints (`apps/bff/src/api/endpoints/knowledge.ts` per H.6 + H.15) currently emit
**no audit events** for reads. KB search emits **no audit events**. The existing F.4 audit
taxonomy supports:

- `data.<entity>.write` (factory) — emitted on KB editor save (I.4)
- `data.<entity>.delete` (factory) — emitted on KB delete (I.4)

But **not** `data.<entity>.read` and **not** `data.<entity>.search`. Adding these factories
would expand the F.4 taxonomy.

## Why J.4 closes as N/A (not deferred)

Three concrete reasons:

1. **Conflict between original prompt §Open questions J.4 recommendation and §Hard rules**.
   The §Open questions recommended audit-log derivation with `data.kb.read` / `data.kb.search`
   names; the §Hard rules explicitly enumerate the allowed taxonomy as
   `data.<entity>.{write,delete} + authn.* + authz.* + details.op discriminator` — `read` and
   `search` are not in that set. User-resolved 2026-06-04 in favour of the Hard rule (no
   taxonomy expansion).
2. **No signal source on the current backend**. CA SDM 17.4 doesn't expose KB analytics. The
   real signal source would have to be FE telemetry beacons + BFF ingest, which is a
   purpose-built telemetry channel — not "audit derivation". The dev/test instance produces
   zero traffic, J.0 (staging deploy) is deferred until cluster provisioning, so even if the
   pipeline were built today, the dashboard would show empty aggregates indefinitely.
3. **MSW fixture is the production behaviour on this instance**. I.4 (PR #45) explicitly
   designed the BFF endpoint to return identical synthetic snapshots as MSW. When/if a real
   traffic source becomes available, the swap point is `kb-analytics.ts` line 103 (`c.json(fixtureSnapshot(range))` → `c.json(await aggregateFromTelemetry(range))`) — that is a
   one-line change at the call site, with the heavy lifting in the telemetry collection
   pipeline (which has no signal source today).

If a future v2.0 scope brings production traffic + a decision to build the telemetry
channel, the work splits into two chunks: (a) FE beacon emission + BFF ingest endpoint + log
storage, (b) aggregation logic + swap-in at the `kb-analytics.ts` call site. Estimated 2-3
days each; not a Phase J chunk.

## Outputs (this closure)

```
docs/plans/J.4.md                                   # NEW: this file (status N/A)
docs/CHANGELOG.md                                   # MOD: Known issues entry refined re: J.4 finding
docs/ROADMAP.md                                     # J.4 → ✅ N/A; J.5 → 🔜 NEXT
```

**Direct commit on `main`** — same pattern as J.0 + J.2 closures.

## Done-when

- [x] Pre-flight inventory of existing KB audit emissions documented (zero matches).
- [x] J.4 marked N/A in this file with the three reasons above.
- [x] CHANGELOG Known issues entry refined to point at J.4.md.
- [x] ROADMAP toggle.

## Open questions / risks — recommended resolutions

- **What if user wants J.4 reopened later?** — Trivial reopening criteria: production traffic
  available + agreement to add either `data.kb.read`/`data.kb.search` audit factories (small
  F.4 expansion) or a purpose-built telemetry channel. Either path is ~2-3 day chunk; not
  blocked on infrastructure.
- **Does the MSW fixture lie to the user?** — No. The fixture displays plausible synthetic
  data labelled in i18n as analytics output; users with `kb.analytics` permission see a
  consistent dashboard demoing the _shape_ of analytics, not real numbers. When/if production
  traffic flows, swapping in real data is invisible to the FE.
- **Privacy considerations** — moot today (no real PII collected). When telemetry is built,
  search queries need truncation + no-PII allowlist (free-text search queries could carry
  customer names, ticket IDs, etc.). Document as constraint for the future chunk.

## Notes

This is a docs-only closure. No code touched. Subagent dispatch is **not** applicable.
