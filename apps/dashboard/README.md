# Dashboard EnerVision

Application **Nuxt 4** fullstack : le même conteneur sert l'interface et l'API REST.

## Architecture

```
                         ┌──────────┐   ecriture   ┌──────────────────┐
                    ┌──▶│   ETL    │────────────▶│  Volume Parquet  │
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
| Validation | Zod — schémas dans `shared/` (partagés front/back, `transform` à la frontière pour `camelCase` → `snake_case`) |

## Sécurité

- Sessions serveur : cookies `httpOnly`, `secure`, `sameSite=strict`, et pas de JWT côté client.
- Autorisation : trois rôles au schéma, **`ADMIN`, `OPERATOR`, `VIEWER`**, et le périmètre d'un compte est une **liste de sites** portée par la table `user_sites` (cf. [`docs/data.md`](../../docs/data.md)). Les trois rôles sont présents dans le schéma et dans le garde (`requireRole`). Au MVP, seul `ADMIN` est effectivement exploité : les routes d'administration vérifient ce rôle, les deux autres (`OPERATOR`, `VIEWER`) sont prêts mais aucune route ne les contraint encore. Une seule fonction rend la liste des sites autorisés et le filtre est toujours appliqué, jamais une branche qui saute le `WHERE`.
- Autorisation par rôle : `requireRole(event, 'ADMIN')` dans `server/utils/guard.ts` appelle `requireAccount` puis compare le rôle relu en base. Déclasser un compte prend effet à la prochaine requête, sans attendre l'expiration de la session (#95).
- Validation entrées : Zod sur chaque route API. Les schémas des routes admin sont dans `shared/adminSchema.ts` : `createUserSchema` (création) et `updateUserSchema` (patch partiel). Les identifiants de sites y sont contraints au pattern `SITE\d{3}`, et les rôles à l'enum `ADMIN | OPERATOR | VIEWER`.
- Rate limiting sur `/api/auth/login`.
- Reverse proxy : TLS, CSP, HSTS, X-Frame-Options.

## Routes API

Toutes les routes authentifiées passent par `requireAccount` (`server/utils/guard.ts`), qui vérifie la session en base à chaque requête. Les routes à rôle restreint passent en plus par `requireRole`.

### Authentification

| Méthode | Route | Rôle requis | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Ouvre une session, pose le cookie |
| POST | `/api/auth/logout` | authentifié | Révoque la session (`revoked_at`), efface le cookie |
| GET | `/api/auth/session` | authentifié | Retourne le compte courant et ses sites autorisés |

### Sites

| Méthode | Route | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/sites/:id/current` | authentifié | Données temps réel du site (API Mock) |
| GET | `/api/sites/:id/history` | authentifié | Historique du site (DuckDB/Parquet) |
| GET | `/api/stats/summary` | authentifié | Synthèse parc |

### Administration

Réservées au rôle `ADMIN`. Répondent `403 Accès interdit` pour tout autre rôle.

| Méthode | Route | Description | Codes spécifiques |
|---|---|---|---|
| GET | `/api/admin/users` | Liste tous les comptes avec leur rôle et leurs sites | — |
| POST | `/api/admin/users` | Crée un compte (body : `createUserSchema`) | 422 entrée invalide, 409 email déjà utilisé |
| PUT | `/api/admin/users/:id` | Patch partiel d'un compte | 404 introuvable, 422 entrée invalide |
| DELETE | `/api/admin/users/:id` | Supprime un compte | 404 introuvable, 422 identifiant invalide |

Tous les endpoints héritent des codes `401 Session invalide` et `403 Accès interdit` depuis `guard.ts`.

## Création du schéma : tranché

**Drizzle**, décidé le 15 septembre 2026. Le schéma TypeScript est la source de vérité, et
`drizzle-kit generate` puis `drizzle-kit migrate` produisent et appliquent les migrations.

Ce qui départage, c'est le critère de #26 : « une migration **rejouable** ». `drizzle-kit migrate`
tient un journal de ce qui a été appliqué et se relance sans risque, là où un `init.sql` monté dans
`docker-entrypoint-initdb.d` ne s'exécute que sur un répertoire de données vide, donc jamais après
le premier démarrage.

Deux conditions, parce que l'argument d'en face était bon :

- Le **SQL généré est commité** (`apps/dashboard/server/database/migrations/`), pour que le schéma
  se lise sans connaître l'ORM et qu'une revue porte sur du DDL.
- Le schéma **ne se modifie jamais à la main** sur la machine : il se modifie dans le schéma
  TypeScript, la migration est générée, commitée, puis appliquée.

Le script d'amorçage idempotent crée les **trois rôles** et **un compte de démonstration par rôle**.
Il n'amorce **aucun site** : le référentiel appartient à l'ETL, et les attributs des sept sites ne
sont pas connus du dépôt. Voir [`docs/data.md`](../../docs/data.md).

### Démarrage

```bash
pnpm install
pnpm dev:db     # la base, les migrations, l'amorçage
pnpm dev        # http://localhost:3000
```

Aucun fichier à copier, aucune variable à renseigner : la boucle locale lit
[`.env.dev`](../../.env.dev), versionné parce qu'il ne contient aucun secret.
Connexion avec `admin@enervision.local` et le `SEED_PASSWORD` qui s'y trouve.

Depuis la racine du dépôt, préfixer par `pnpm --dir apps/dashboard`. Si `pnpm`
n'est pas sur le `PATH`, `corepack pnpm@10.11.0` fait le même travail avec la
version qu'épingle la CI.

Ce que `pnpm dev:db` lance : **un seul conteneur**, `enervision-db-dev`, sur
`127.0.0.1:55432`, décrit par [`docker-compose.dev.yml`](../../docker-compose.dev.yml).
Ni ETL, ni ML, ni Parquet, et un port distinct de la composition de production
pour que les deux puissent coexister.

### Commandes

| Commande | Effet |
|---|---|
| `pnpm dev:db` | Démarre la base, attend qu'elle réponde, migre et amorce. Rejouable |
| `pnpm dev:db:migrate` | Les seules migrations, après une modification du schéma |
| `pnpm dev:db:seed` | Le seul amorçage |
| `pnpm dev:db:stop` | Arrête la base et libère le port. Les données restent |
| `pnpm dev:db:reset` | Arrête et **jette le volume**. Base vide au passage suivant |
| `pnpm db:generate` | Génère une migration depuis `server/database/schema.ts`. À commiter |
| `pnpm db:migrate` | Applique les migrations en attente, sur la base décrite par `.env`. Rejouable |
| `pnpm db:seed` | Trois rôles, trois comptes de démonstration, et active le rôle `etl` |
| `pnpm lint` | ESLint sur l'applicatif |
| `pnpm typecheck` | Contrôle des types par `vue-tsc -b --noEmit` sur les quatre projets du `tsconfig` de Nuxt : `app`, `server`, `shared`, `node` |
| `pnpm test` | Les tests, dont ceux qui parlent à PostgreSQL. **Docker doit tourner** |
| `pnpm test:watch` | Les mêmes, en mode observateur |

Les tests démarrent eux-mêmes un conteneur `postgres:16-alpine` jetable, par
Testcontainers : il n'y a ni base de test à créer à la main, ni composition à
lancer au préalable. La première exécution tire l'image, les suivantes non.

**Deux fichiers de valeurs, deux usages.** [`.env.dev`](../../.env.dev) sert la
boucle locale : versionné, sans secret, lu par `pnpm dev` et par les commandes
`dev:db`. [`.env.example`](../../.env.example) décrit celles de la composition,
à copier en `.env` et à renseigner ; ce sont `pnpm db:migrate` et `pnpm db:seed`
qui lisent ce dernier. **Aucune variable n'est commune aux deux**, pour qu'une
commande qui se trompe de contexte échoue au lieu de réussir sur la mauvaise
base. Les tests, eux, n'ont besoin ni de l'un ni de l'autre.

## Mots de passe : Argon2id

Le module fournit `hashPassword` et `verifyPassword` en **scrypt**. On lui préfère **Argon2id**, première recommandation de la fiche OWASP « Password Storage », avec `m = 19456`, `t = 2` et `p = 1` au minimum. La bibliothèque retenue est `@node-rs/argon2`, qui livre des binaires précompilés : pas de chaîne de compilation à installer dans l'image Docker. Si le build résiste, le scrypt du module est un repli acceptable, deuxième recommandation OWASP, avec `N = 2^17`, `r = 8`, `p = 1`.

bcrypt est écarté : OWASP le réserve aux systèmes hérités, il ne consomme que 4 Ko de mémoire donc se parallélise sur GPU, et il tronque silencieusement l'entrée à 72 octets.

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
- Gestion des utilisateurs (rôle `ADMIN`) : lister tous les comptes avec leur rôle et leurs sites autorisés, créer un compte, modifier son rôle / ses sites / son statut actif, supprimer un compte
- Avertissement explicite quand des données sont incomplètes (`data_quality`)
