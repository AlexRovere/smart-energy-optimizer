# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-bookworm AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
    && rm -rf /var/lib/apt/lists/*

# pnpm 12 bloque par défaut les scripts de build de dépendances non listées
# dans allowBuilds (ERR_PNPM_IGNORED_BUILDS), y compris pour des paquets
# ajoutés récemment (testcontainers) et jamais approuvés. La 10 n'a pas ce
# comportement bloquant.
RUN corepack enable && corepack use pnpm@10

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /app/.output ./.output

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
