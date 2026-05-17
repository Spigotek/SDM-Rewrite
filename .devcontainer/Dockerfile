# Dev environment image — pinned tooling for SDM-Rewrite.
# Same Node major as runtime image (apps/bff/Dockerfile) → dev=CI=prod parity.
FROM node:22.11.0-bookworm

ARG PNPM_VERSION=9.12.0
ARG TURBO_VERSION=2.3.3
ARG USER_UID=1000
ARG USER_GID=1000

ENV DEBIAN_FRONTEND=noninteractive \
    PNPM_HOME=/home/node/.local/share/pnpm \
    PATH=/home/node/.local/share/pnpm:$PATH \
    SHELL=/bin/bash

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        openssh-client \
        less \
        jq \
        bash-completion \
        gnupg \
        sudo \
        procps \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI (matches host expectation in dev-handbook).
# hadolint ignore=DL3008
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Pinned pnpm + Turborepo via corepack.
RUN corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && npm install -g turbo@${TURBO_VERSION}

# Run as non-root `node` user (UID 1000 by default; aligns with most host UIDs).
USER node
WORKDIR /workspace

CMD ["sleep", "infinity"]
