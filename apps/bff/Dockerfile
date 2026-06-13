# BFF production image — multi-stage build.
# Stage 1: install all workspace deps and prune to BFF subset.
# Stage 2: copy lean runtime layer onto distroless-ish Node alpine.

ARG NODE_VERSION=22.11.0

# ----- deps ------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps

ARG PNPM_VERSION=9.12.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /repo

# Copy lockfile + manifests for deterministic, layer-cacheable install.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/bff/package.json apps/bff/
COPY apps/pm/package.json apps/pm/
COPY apps/portal/package.json apps/portal/
COPY apps/workspace/package.json apps/workspace/
COPY packages/ packages/
COPY tools/ tools/

RUN pnpm install --frozen-lockfile

# ----- build -----------------------------------------------------------------
FROM deps AS build

COPY tsconfig.base.json tsconfig.json eslint.config.js ./
COPY apps/bff apps/bff
COPY packages packages
COPY tools tools

# Stub build is a no-op today; in chunk 2 this runs `pnpm --filter @sdm/bff build`
# which produces dist/index.js via tsup.
RUN pnpm --filter @sdm/bff build \
    && pnpm --filter @sdm/bff deploy --prod /out

# ----- runtime ---------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime

ARG GIT_SHA=unknown
ARG VERSION=0.1.0
# Build-time metadata threaded into the /config endpoint. release.yml passes
# the release tag as BFF_APP_VERSION and the commit SHA as BFF_BUILD_ID; both
# are promoted to ENV below so `applyEnvOverrides` in platform/config/load.ts
# picks them up at container start without any per-deploy wiring.
ARG BFF_APP_VERSION=0.0.0-dev
ARG BFF_BUILD_ID=local

LABEL org.opencontainers.image.title="sdm-bff" \
      org.opencontainers.image.description="SDM-Rewrite Backend-for-Frontend (Hono 4)" \
      org.opencontainers.image.source="https://github.com/Spigotek/SDM-Rewrite" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}"

ENV NODE_ENV=production \
    BFF_PORT=5174 \
    NODE_OPTIONS=--enable-source-maps \
    BFF_APP_VERSION=${BFF_APP_VERSION} \
    BFF_BUILD_ID=${BFF_BUILD_ID}

# Run as non-root.
RUN addgroup -S sdm && adduser -S -G sdm sdm

WORKDIR /app
COPY --from=build --chown=sdm:sdm /out ./
USER sdm

EXPOSE 5174

# Production CMD — runs the tsup-bundled BFF entrypoint. The dev-only `tsx`
# loader is pruned by `pnpm deploy --prod` above, so the previous stub form
# (`node --import tsx/esm src/index.ts`) crashes immediately at boot.
CMD ["node", "dist/index.js"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${BFF_PORT}/health" || exit 1
