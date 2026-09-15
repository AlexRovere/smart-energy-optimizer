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
| ORM | Drizzle ORM, source de vérité du schéma (voir plus bas) |
| Auth | nuxt-auth-utils, cookie portant un identifiant de session, état en base |
| BDD | PostgreSQL 16 (comptes, rôles, référentiel des sites et leurs réglages) |
| Package manager | pnpm |

## Sécurité

- Sessions serveur : cookies `httpOnly`, `secure`, `sameSite=strict` — pas de JWT côté client.
- Autorisation : trois rôles au schéma, **`ADMIN`, `OPERATOR`, `VIEWER`**, et le périmètre d'un compte est une **liste de sites** portée par la table `user_sites` (cf. [`docs/data.md`](../../docs/data.md)). **Un seul rôle est exploité au MVP**, `ADMIN` : le mécanisme est construit et testé, les profils restreints se montrent à l'oral. Une seule fonction rend la liste des sites autorisés et le filtre est toujours appliqué, jamais une branche qui saute le `WHERE`.
- Validation entrées : Zod sur chaque route API (schémas partagés front/back).
- Rate limiting sur `/api/auth/login`.
- Reverse proxy : TLS, CSP, HSTS, X-Frame-Options.

## Création du schéma : tranché

**Drizzle**, décidé le 15 septembre 2026. Le schéma TypeScript est la source de vérité, et
`drizzle-kit generate` puis `drizzle-kit migrate` produisent et appliquent les migrations.

Ce qui départage, c'est le critère de #26 : « une migration **rejouable** ». `drizzle-kit migrate`
tient un journal de ce qui a été appliqué et se relance sans risque, là où un `init.sql` monté dans
`docker-entrypoint-initdb.d` ne s'exécute que sur un répertoire de données vide, donc jamais après
le premier démarrage.

Deux conditions, parce que l'argument d'en face était bon :

- Le **SQL généré est commité** (`drizzle/0000_*.sql`), pour que le schéma se lise sans connaître
  l'ORM et qu'une revue porte sur du DDL.
- Le schéma **ne se modifie jamais à la main** sur la machine : il se modifie dans le schéma
  TypeScript, la migration est générée, commitée, puis appliquée.

Le script d'amorçage idempotent (trois rôles, sept sites, un compte de démonstration par rôle) est
repris tel quel de la proposition de contrats d'interfaces.

## Sessions : la révocation vit en base

`nuxt-auth-utils` scelle les données de session **dans le cookie** : le serveur ne garde rien, donc
ne peut rien révoquer. `clearUserSession` vide le cookie du navigateur, mais une copie prise avant
reste valable jusqu'à expiration. Or #29 exige qu'un cookie rejoué après déconnexion réponde 401.

Le cookie ne porte donc qu'un **identifiant de session opaque**, et l'état vit dans la table
`sessions` (cf. [`docs/data.md`](../../docs/data.md)). La déconnexion pose `revoked_at`, le rejeu
répond 401, et la révocation est par appareil.

Le **rôle est relu en base à chaque requête**, jamais porté par le cookie : c'est ce qu'impose le
dernier critère de #95, « retirer un rôle fait échouer l'action correspondante, vérifié, pas
supposé ». Une seule requête sert les trois vérifications : session valide, compte actif, rôle
courant.

## Fonctionnalités

- Consommation par site et pour le parc
- Prédictions et recommandations (dégradation gracieuse si ML absent)
- Alertes actives
- Santé des capteurs
- Gestion des utilisateurs (admin)
- Avertissement explicite quand des données sont incomplètes (`data_quality`)
