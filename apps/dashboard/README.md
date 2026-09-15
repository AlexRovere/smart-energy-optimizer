# Dashboard EnerVision

Application **Nuxt 4** fullstack — le même conteneur sert l'interface et l'API REST.

## Architecture

```
                         ┌──────────┐        ┌──────────────┐
                    ┌───▶│   ETL    │──write─▶│ Data Parquet │
                    │    │ (Python) │        │  (DuckDB)    │
┌──────────────┐    │    └──────────┘        └──────┬───────┘
│   API Mock   │────┤                               │
│  (externe)   │    │                               │ query
└──────────────┘    │                               │ (HTTP)
                    │    ┌──────────────┐            │
                    │    │     ML       │──HTTP──┐   │
                    │    │ (Python +    │        │   │
                    │    │  MLflow)     │        │   │
                    │    └──────────────┘        │   │
                    │                           ▼   ▼
                    │  HTTP   ┌──────────────────────────┐
                    └────────▶│    Dashboard (Nuxt 4)    │
                     (direct) │  SSR + API /server/api/  │
┌──────────────┐              │  Auth + RBAC             │
│  PostgreSQL  │◀───TCP/SQL──│                          │
│  (users,     │              └────────────┬─────────────┘
│   rôles)     │                           │ HTTPS
└──────────────┘              ┌────────────▼─────────────┐
                              │     Reverse Proxy        │
                              │    (Caddy / Traefik)     │
                              └────────────┬─────────────┘
                                           │ HTTPS
                                      Navigateur
```

**Flux données temps réel** : API Mock → Nuxt → Dashboard (appel direct).
**Flux données historiques** : API Mock → ETL → Parquet/DuckDB → Nuxt → Dashboard.

## Stack technique

| Couche | Choix |
|---|---|
| Framework | Nuxt 4 (Vue 3 + TypeScript) |
| UI | NuxtUI (Radix / Tailwind) |
| ORM | Drizzle ORM |
| Auth | nuxt-auth-utils (sessions serveur) |
| BDD | PostgreSQL 16 (users, rôles) |
| Package manager | pnpm |

## Sécurité

- Sessions serveur : cookies `httpOnly`, `secure`, `sameSite=strict` — pas de JWT côté client.
- RBAC : 3 rôles (admin, manager, operator). Operator scopé par `allowedSites`.
- Validation entrées : Zod sur chaque route API (schémas partagés front/back).
- Rate limiting sur `/api/auth/login`.
- Reverse proxy : TLS, CSP, HSTS, X-Frame-Options.

## Fonctionnalités

- Consommation par site et pour le parc
- Prédictions et recommandations (dégradation gracieuse si ML absent)
- Alertes actives
- Santé des capteurs
- Gestion des utilisateurs (admin)
- Avertissement explicite quand des données sont incomplètes (`data_quality`)
