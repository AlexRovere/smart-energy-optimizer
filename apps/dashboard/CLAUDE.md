# CLAUDE.md — EnerVision Dashboard

## Projet

**EnerVision** — Smart Energy Optimizer MVP. Dashboard de monitoring énergétique pour un parc de 7 sites industriels.
Sprint EADL : 14-25 sept. 2026 (10 jours ouvrés). Soutenances : 24/09 (orale) + 25/09 (finale + rendu).

Repo GitHub : `EADL-2026/enerVision` — ce dossier est `apps/dashboard/`.

## État actuel du repo (J2 — 15/09)

Le dashboard est au stade **scaffold initial** :
- `pnpm create nuxt` effectué (Nuxt 4.5, Vue 3, TypeScript strict)
- `nuxt dev` fonctionne
- Aucun composant, aucune route API, aucun test, aucune dépendance métier installée

Reste à faire aujourd'hui (J2) : ESLint, Vitest, NuxtUI, Dockerfile, config env (`runtimeConfig`).

## Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Framework | **Nuxt 4** (Vue 3 + TypeScript strict) | SSR + API routes en un conteneur, équipe familière Vue |
| UI | **NuxtUI** (Radix Vue + Tailwind) | Composants accessibles, theming, DX auto-imports |
| ORM | **Drizzle ORM** | Type-safe, ~50kB (vs Prisma 15MB), pas de binaire natif |
| Auth | **nuxt-auth-utils** | Sessions serveur, cookies chiffrés, pas de JWT |
| Validation | **Zod** | Schémas partagés front/back (`shared/schemas/`) |
| Hash mdp | **argon2** | Recommandation OWASP |
| Package manager | **pnpm** | Standard projet |
| Tests | **Vitest** (unitaire + intégration) | TDD, couverture ≥ 80% logique métier |
| E2E | Playwright (stretch P2) | Seulement si le temps le permet |

## Architecture

Infrastructure **on-premise** (VM ENI). Conteneurs Docker Compose, un seul port publié (443 reverse proxy).

```
Navigateur ──HTTPS──▶ Reverse Proxy (443) ──HTTP──▶ Nuxt (:3000, SSR + API)
                                                       │          │          │
                                                TCP/SQL│          │HTTP      │ montage lecture seule
                                                       ▼          ▼          ▼
                                                  PostgreSQL   Service ML   Répertoire Parquet
                                               (comptes, rôles,             (dossier exposé)
                                                réf. des sites)
```

**Deux réseaux internes** : frontal (proxy ↔ app) et données (app ↔ PostgreSQL, app ↔ ML).
L'ETL n'est sur aucun réseau interne — il n'a qu'un montage en écriture sur le volume Parquet.

Le conteneur Nuxt est le seul point d'entrée. Il appelle :
- **PostgreSQL** pour l'auth, les utilisateurs et le référentiel des sites
- **API Mock** directement pour les données temps réel (sites, lectures, alertes, stats)
- **Répertoire Parquet** via DuckDB embarqué pour les données historiques (montage lecture seule du dossier exposé)
- **Service ML** pour les prédictions (dégradation gracieuse si absent)

> **DuckDB est une bibliothèque embarquée dans Nuxt** (`@duckdb/node-api`), pas un serveur. Il n'existe pas de conteneur "Data Parquet". Les fichiers vivent dans un répertoire de la machine, monté dans les conteneurs qui en ont besoin.

## Structure cible

```
apps/dashboard/
├── app/                    # Frontend Nuxt
│   ├── components/         # Composants Vue
│   ├── composables/        # useFleet, useSite, usePolling...
│   ├── layouts/            # Default layout (sidebar, header)
│   ├── middleware/          # Auth redirect côté client
│   └── pages/              # Routes : login, dashboard, sites, etc.
├── server/
│   ├── api/                # Routes API REST
│   │   ├── auth/           # login, logout, session
│   │   ├── admin/          # CRUD users (admin only)
│   │   ├── sites/          # Proxy vers API Mock / Data Parquet
│   │   └── ...             # alerts, readings, stats, predictions
│   ├── database/
│   │   └── schema/         # Schéma Drizzle (source de vérité)
│   ├── middleware/          # Auth server-side (deny-by-default)
│   └── utils/              # requireRole, hashPassword, client HTTP Mock API, DuckDB queries
├── shared/
│   └── schemas/            # Schémas Zod partagés front/back
├── tests/                  # *.test.ts (Vitest)
├── nuxt.config.ts
├── drizzle.config.ts
└── Dockerfile              # Multi-stage (build + prod)
```

## Sécurité (priorité haute — critère de notation +++)

- Sessions serveur (`httpOnly`, `secure`, `sameSite=strict`), pas de JWT en localStorage
- RBAC 3 rôles : `ADMIN`, `OPERATOR`, `VIEWER` — un seul exploité au MVP (`ADMIN`), les autres montrés à l'oral et dans les tests. Périmètre scopé par `user_sites` (liste de sites autorisés)
- Middleware auth server deny-by-default (toutes les `/api/` protégées sauf `/api/auth/*` et `/api/health`)
- Rate limiting sur `/api/auth/login`
- Validation Zod sur chaque entrée API
- Pas de secret dans le code — tout via `runtimeConfig` / `.env`
- Pas de stack trace en production
- Headers sécurité via reverse proxy (HSTS, CSP, X-Frame-Options, etc.)

## Variables d'environnement

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL |
| `MOCK_API_URL` | URL de l'API Mock (données temps réel) |
| `PARQUET_DIR_EXPOSE` | Chemin du répertoire Parquet exposé (montage lecture seule) |
| `ML_SERVICE_URL` | URL du service ML (réseau Docker interne) |
| `NUXT_SESSION_SECRET` | Secret session (≥ 32 chars) |
| `LOG_LEVEL` | Niveau de log (`debug`, `info`, `warn`, `error`) |

## Commandes

```bash
pnpm dev          # Dev server
pnpm build        # Build production
pnpm test         # Tests Vitest (à configurer)
pnpm lint         # ESLint (à configurer)
```

## Documentation interne (.claude/ — gitignored)

Fichiers de conception et suivi personnel, non versionnés :

| Fichier | Contenu |
|---|---|
| `CONTEXT.md` | Contexte projet, ressources, rôle, critères de notation |
| `ARCHITECTURE.md` | Architecture détaillée, stack, sécurité, tests, observabilité |
| `DECISIONS.md` | Décisions techniques validées (stack, RBAC, auth, tests, logs) avec justifications et exemples de code |
| `INTERFACES.md` | Contrats d'interfaces complets : API dashboard (16 routes), schémas de données, flux Mock API / Data Parquet / ML, gestion des nulls, dégradation gracieuse |
| `API_SCHEMA.md` | Référence rapide API pour le PO : routes, modèles JSON, matrice RBAC |
| `DESIGN.md` | Notes de dev front-end : mapping écrans/endpoints, design tokens, composants fournis, règles de design, layouts |
| `ROADMAP.md` | Planning jour par jour (J1-J10), backlog par Epic (A-J), registre des risques, Definition of Done |
| `TODO.md` | Checklist opérationnelle jour par jour avec toutes les tâches et leur statut |
| `daylies/01_daily_15-09.md` | Compte-rendu daily J2 : décisions validées, tâches du jour |

## Décisions clés (résumé)

- **Pas de table `companies`** — hors sujet MVP, on ne garde que `sites` (décision 15/09)
- **3 rôles RBAC** : `ADMIN`, `OPERATOR`, `VIEWER` — seul `ADMIN` exploité au MVP, les autres montrés à l'oral
- **Admin seul** gère les utilisateurs pour le MVP
- **PostgreSQL Docker** pour les tests d'intégration (même moteur que prod)
- **E2E Playwright** = stretch goal P2
- **Logs niveau 2** (Loki/Grafana) = stretch goal, niveau 1 (`consola` + `docker logs`) suffit

## Conventions

- Tests dans `tests/` : `*.test.ts`
- Commits conventionnels, branches selon nomenclature groupe
- ESLint avec `@nuxt/eslint-config` (CI bloquante)
- Nuxt conventions : auto-imports, `/server`, `/composables`, `/components`
