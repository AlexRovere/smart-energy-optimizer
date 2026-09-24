# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-bookworm AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
      g++ \
      make \
      python3 \
    && rm -rf /var/lib/apt/lists/*

# pnpm 12 bloque par défaut les scripts de build de dépendances non listées
# dans allowBuilds (ERR_PNPM_IGNORED_BUILDS), y compris pour des paquets
# ajoutés récemment (testcontainers) et jamais approuvés. La 10 n'a pas ce
# comportement bloquant.
RUN corepack enable && corepack use pnpm@10.11.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime

# Le serveur Nitro est autonome : ni npm ni corepack ne servent à l'exécuter.
# Le npm de l'image de base embarque en revanche sa propre copie de node-tar,
# porteuse d'une CVE critique (CVE-2026-59873, PR #138). Les retirer supprime
# la faille à la racine au lieu de la contourner, et réduit la surface d'une
# image de production qui n'a aucune raison d'installer des paquets. Yarn,
# fourni aussi par l'image de base, part pour la même raison (#225).
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm \
           /usr/local/bin/npx \
           /usr/local/bin/corepack \
           /usr/local/bin/yarn \
           /usr/local/bin/yarnpkg \
           /opt/yarn-v*

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
