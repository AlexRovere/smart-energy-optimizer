# Dashboard EnerVision

Application **Nuxt 4** fullstack — le même conteneur sert l'interface et l'API REST.

## Architecture

```
                         ┌──────────┐   ecriture   ┌──────────────────┐
                    ┌───▶│   ETL    │─────────────▶│  Volume Parquet  │
                    │    │ (Python) │   (montage)  │ expose / entrain.│
┌──────────────┐    │    └──────────┘              └──────┬───────────┘
│   API Mock   │────┤                                     │
│  (externe)   │    │                       montage lecture seule
└──────────────┘    │                       + DuckDB en bibliotheque
                    │    ┌──────────────┐          │
                    │    │     ML       │──HTTP──┐ │
                    │    │ (Python +    │        │ │
                    │    │  MLflow)     │        │ │
                    │    └──────────────┘        │ │
                    │                           ▼ ▼
                    │  HTTP   ┌──────────────────────────┐
                    └────────▶│    Dashboard (Nuxt 4)    │
                     (direct) │  SSR + API /server/api/  │
┌──────────────┐              │  Auth + autorisation     │
│  PostgreSQL  │◀───TCP/SQL──│                          │
│  (comptes,   │              └────────────┬─────────────┘
│ roles, sites)│                           │ HTTPS
└──────────────┘              ┌────────────▼─────────────┐
                              │     Reverse Proxy        │
                              │    (Caddy / Traefik)     │
                              └────────────┬─────────────┘
                                           │ HTTPS
                                      Navigateur
```

> **Le stockage n'est pas un service.** Il n'y a ni conteneur, ni port, ni API devant les fichiers
> Parquet : c'est un volume Docker que l'ETL monte en écriture et que l'applicatif monte en lecture
> seule, sur le seul répertoire exposé. Lire une partition est une requête DuckDB sur un chemin
> local, pas un appel HTTP. C'est aussi ce qui fait le cloisonnement : ce qui n'est pas monté n'est
> pas lisible, et cela se vérifie dans le fichier de composition. Voir
> [`docs/architecture.md`](../../docs/architecture.md).

**Flux données temps réel** : API Mock → Nuxt → Dashboard (appel direct).
**Flux données historiques** : API Mock → ETL → Parquet/DuckDB → Nuxt → Dashboard.

## Stack technique

| Couche | Choix |
|---|---|
| Framework | Nuxt 4 (Vue 3 + TypeScript) |
| UI | NuxtUI (Radix / Tailwind) |
| ORM | Drizzle ORM — voir la note sur les migrations plus bas |
| Auth | nuxt-auth-utils (sessions serveur) |
| BDD | PostgreSQL 16 (comptes, rôles, référentiel des sites et leurs réglages) |
| Package manager | pnpm |

## Sécurité

- Sessions serveur : cookies `httpOnly`, `secure`, `sameSite=strict` — pas de JWT côté client.
- Autorisation : trois rôles au schéma, **`ADMIN`, `OPERATOR`, `VIEWER`**, et le périmètre d'un compte est une **liste de sites** portée par la table `user_sites` (cf. [`docs/data.md`](../../docs/data.md)). **Un seul rôle est exploité au MVP**, `ADMIN` : le mécanisme est construit et testé, les profils restreints se montrent à l'oral. Une seule fonction rend la liste des sites autorisés et le filtre est toujours appliqué, jamais une branche qui saute le `WHERE`.
- Validation entrées : Zod sur chaque route API (schémas partagés front/back).
- Rate limiting sur `/api/auth/login`.
- Reverse proxy : TLS, CSP, HSTS, X-Frame-Options.

## Création du schéma : point à trancher

Drizzle apporte son propre outil de migrations, alors que [`docs/data.md`](../../docs/data.md) acte
un `init.sql` monté par la composition. Deux façons de créer le même schéma, il faut en choisir une.

L'argument pour Drizzle : l'applicatif est le **seul** service à toucher PostgreSQL, donc le schéma
peut lui appartenir entièrement, et les types TypeScript sont générés depuis lui. L'argument pour
`init.sql` : rien à installer, la base se recrée en une commande, et le schéma se lit sans connaître
l'ORM. À trancher au daily ; ce qui ne se discute pas, c'est qu'il n'y en ait qu'un.

## Fonctionnalités

- Consommation par site et pour le parc
- Prédictions et recommandations (dégradation gracieuse si ML absent)
- Alertes actives
- Santé des capteurs
- Gestion des utilisateurs (admin)
- Avertissement explicite quand des données sont incomplètes (`data_quality`)
