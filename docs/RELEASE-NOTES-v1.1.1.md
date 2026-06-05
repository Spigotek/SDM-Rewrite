# Service Desk Management v1.1.1

**Service Desk Management v1.1.1** — hotfix release. Single one-line change in
`apps/bff/Dockerfile` to make the BFF production image actually startable.

> Released 2026-MM-DD. Source tag: [`v1.1.1`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.1).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).

## What broke

The BFF Dockerfile carried a stub `CMD` from the chunk-1 era that ran the entry
point through the dev-only `tsx/esm` loader against `src/index.ts`. The image
build does run `pnpm --filter @sdm/bff build` (producing the tsup-bundled
`dist/index.js`) and then `pnpm deploy --prod /out` (which strips `tsx`), so on
startup the container would immediately fail with `ERR_MODULE_NOT_FOUND: Cannot
find package 'tsx'` and crash-loop. The defect existed in every BFF image
shipped since v1.0; J.0 staging smoke surfaced it on 2026-06-05 because the
chart had never been exercised against a real runtime.

## Fix

`apps/bff/Dockerfile`:

```dockerfile
- CMD ["node", "--import", "tsx/esm", "src/index.ts"]
+ CMD ["node", "dist/index.js"]
```

`apps/bff/package.json` already declares `"start": "node dist/index.js"` — this
hotfix simply aligns the Dockerfile with the long-standing intended production
entry point.

## Verification

After re-cutting the BFF image at `1.1.1`, the container boots cleanly and the
BFF reaches the `bff: started` log line + listens on `:5174` within ~2 s. The
`/readyz` probe is then gated only on the CA SDM 17.4 broker bootstrap (which
is the J.0 §Open question of the moment, not the image defect).

## Affected artefacts

- `ghcr.io/spigotek/sdm-bff:1.1.1` (also `1.1`, `latest`) — multi-arch
  (`linux/amd64` + `linux/arm64`).
- Helm chart `oci://ghcr.io/spigotek/charts/sdm:1.1.1` — chart version + appVersion
  bumped to `1.1.1` by `release.yml` packaging step; no chart template changes.
- Portal + Workspace images re-published at `1.1.1` (unchanged source, same
  multi-arch shape as `1.1.0`).

## Not affected

- Feature set is identical to v1.1.0 — see
  [`RELEASE-NOTES-v1.1.md`](./RELEASE-NOTES-v1.1.md) for the per-persona view.
- F.4 audit taxonomy frozen; no new event names.
- No API breaking changes; in-place `helm upgrade` from `1.1.0` to `1.1.1`.

## Migration

`helm upgrade --install sdm oci://ghcr.io/spigotek/charts/sdm --version 1.1.1`,
or for the Docker-compose path used by J.0 staging:

```bash
SDM_TAG=1.1.1 docker compose -f compose.staging.yml --env-file .env.staging up -d
```

(No `command:` override needed — the image now boots on its own production CMD.)
