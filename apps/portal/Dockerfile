# Portal SPA — static assets served by nginx.
ARG NODE_VERSION=22.11.0
ARG NGINX_VERSION=1.27.3

# ----- deps + build ----------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS build

ARG PNPM_VERSION=9.12.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/portal/package.json apps/portal/
COPY apps/workspace/package.json apps/workspace/
COPY apps/bff/package.json apps/bff/
COPY apps/pm/package.json apps/pm/
COPY packages/ packages/
COPY tools/ tools/

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json tsconfig.json eslint.config.js ./
COPY apps/portal apps/portal
COPY packages packages

RUN pnpm --filter @sdm/portal build

# ----- runtime ---------------------------------------------------------------
FROM nginx:${NGINX_VERSION}-alpine AS runtime

ARG GIT_SHA=unknown
ARG VERSION=0.1.0

LABEL org.opencontainers.image.title="sdm-portal" \
      org.opencontainers.image.description="SDM-Rewrite Self-service portal (React 19 + Vite)" \
      org.opencontainers.image.source="https://github.com/Spigotek/SDM-Rewrite" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}"

COPY apps/portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/portal/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1
