# F.1 — `/clear` prompt

> Copy-paste do nového chatu po `/clear`. Žiadny implicitný kontext z minulých session-ov —
> všetko čo treba je v `docs/plans/F.1.md` + linkované Inputs + auto-loaded memory.

```text
Pokračujeme SDM-Rewrite. Najbližší chunk: F.1 — BFF Auth module.

Plán (Inputs / Outputs / Done-when / Stratégia / Open questions):
→ docs/plans/F.1.md

Phase F overview + cross-chunk rozhodnutia D1–D6 (najmä D1 = Basic Auth, nie OIDC):
→ docs/plans/F.md

Status + PR-flow + creds (deploy + real CA SDM B-E):
auto-loaduje sa z MEMORY.md (per-project auto-memory, mimo repo).
NIKDY nepúšťaj heslá do repo / commit / PR body.

Postup:
1. Prečítaj docs/plans/F.1.md + docs/plans/F.md.
2. Otvor súbory zo sekcie Inputs v F.1.md (najmä auth-flow.md a bff.md §2.0-2.2).
3. Krátky plán (~5 viet) — len pivot vs plán súbor + sanity check; netvor špec znova.
4. `git checkout -b chunk/F.1-bff-auth` od main.
5. Fáza A — 3 paralelné subagenty v jednom message-i (A1 Explore real B-E,
   A2 general-purpose session+cookies, A3 general-purpose config+CSRF).
   Brief každého so self-contained promptom: file paths + Inputs sekcia z F.1.md
   + acceptance criteria.
6. Fáza B — main thread po doručení Fáza A outputov: SDM broker → routes → /me
   → integ testy.
7. Verifikácia: pnpm -r typecheck/lint/build/test + live smoke proti real B-E.
8. ROADMAP toggle F.1 → DONE + status hlavičky v docs/plans/F.1.md.
9. Push branch + gh pr create. NIE push direct na main (per memory feedback_pr_flow).

Ak narazíš na nejasnosť v pláne — povedz pred začatím Fázy A, nehádaj.
```

## Operatívne poznámky (pre tvorcu prompt-u, nie pre LLM)

- **Memory creds**: subagent A1 dostáva CA SDM creds v brief prompte, ale jeho output
  (`docs/agents/devex-devops/real-backend-contracts.md`) musí heslá **redact-nuť** pred commitom.
  Zapísané v `real_backend.md` memory.
- **Sieťový prístup**: ak `10.11.35.35:8050` nie je z dev stroja dostupný, A1 to zistí curl-om prvé
  a F.1 plán má `[blocked-on-network]` fallback (MSW Node mocky + live smoke ide do follow-up chunku).
- **Subagent briefing**: každý subagent je čistý kontext. Brief obsahuje absolute file paths,
  acceptance criteria (test commands), a NIKDY sa nespolieha na "kontext z minulého session-u".
  F.1.md tabuľka Fáza A už má rozsah každého subagenta — stačí prilepiť jeho riadok + `Inputs` zoznam.
