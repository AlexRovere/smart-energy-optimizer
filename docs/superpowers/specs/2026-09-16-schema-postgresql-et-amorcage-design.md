# Schéma PostgreSQL et amorçage (#126)

Conception validée le 16 septembre 2026. Issue [#126](https://github.com/EADL-2026/enerVision/issues/126), sortie de #28.

Ce document dit **comment** on écrit ce que [`data.md`](../../data.md) a déjà figé. Il ne rouvre aucune décision de modèle : les cinq tables, leurs colonnes, leurs types et leurs contraintes sont la référence, et toute différence entre ce document et `data.md` est un défaut de ce document.

## Ce que le ticket demande, et ce qui est réellement en jeu

Transcrire cinq tables en Drizzle est mécanique. Trois choses ne le sont pas, et ce sont elles qui portent la valeur :

- Le **rôle `etl` avec ses droits par colonne** : du moindre privilège appliqué à une base, qui se démontre en essayant et en se faisant refuser. Attendu d'épreuve EC04.
- Le **test qui compare le schéma appliqué à `data.md`** : sans lui, le document et la base divergent en trois jours et personne ne s'en aperçoit avant la soutenance. Attendu d'épreuve EC05, C27.
- La **rejouabilité**, qui est la raison pour laquelle Drizzle a été préféré à un `init.sql` monté dans `docker-entrypoint-initdb.d`.

## Décisions prises pendant la conception

Quatre points ne se tranchaient pas depuis le dépôt. Ils l'ont été le 16 septembre 2026.

| Question | Retenu | Motif |
| :--- | :--- | :--- |
| Base PostgreSQL pour les tests | **Testcontainers** (`@testcontainers/postgresql`) | Une seule commande, `pnpm test`, identique sur un poste et sur un runner. Un service CI plus une compose locale font deux chemins à maintenir, et le test échoue chez qui n'a pas lancé la compose |
| Amorçage des sept sites | **Aucun site amorcé** | Seuls les identifiants `SITE001` à `SITE007` et la liste des sept `site_type` sont connus. `name`, `type`, `capacity_kw` et `status` sont `NOT NULL` et viennent de l'API Mock. Et `apps/etl/load/sites_repository.py` n'insère que les sites absents : il ne corrige jamais une ligne existante, donc une valeur inventée resterait en base pour de bon |
| Emplacement du rôle `etl` | **Migration Drizzle « custom »** (`drizzle-kit generate --custom`) | Un seul mécanisme rejouable, et la revue porte sur du DDL. `pgRole` de drizzle-orm ne sait pas exprimer un `GRANT` par colonne, et un rôle créé par le script d'amorçage ferait reposer la rejouabilité sur le script plutôt que sur le journal |
| Secret du rôle `etl`, alors que #52 n'est pas fusionnée | **Déclarer la variable, pas la valeur** | `ETL_DB_PASSWORD=` vide dans `.env.example`, et le chiffrement SOPS reste le travail de #52. Les deux branches restent fusionnables dans n'importe quel ordre, et #126 ne bloque pas #29 ni #95 |

## Architecture

Tout vit dans `apps/dashboard/`, propriétaire du schéma.

```
apps/dashboard/
  drizzle.config.ts                      existe déjà, inchangé
  server/database/
    schema.ts                            les cinq tables (remplace `export {}`)
    migrations/0000_*.sql                généré par drizzle-kit, commité
    migrations/0001_role_etl.sql         custom, écrit à la main
    migrations/meta/                     journal drizzle-kit, commité
    seed.ts                              `seed(sql)`, importable et testable
    seed.cli.ts                          point d'entrée de `pnpm db:seed`
  tests/database/
    global-setup.ts                      un conteneur pour toute la suite
    base-de-test.ts                      une base jetable par fichier de test
    data-md.ts                           lit et analyse les cinq tableaux de data.md
    schema-conforme-au-document.test.ts
    migration-rejouable.test.ts
    role-etl-moindre-privilege.test.ts
    amorcage-idempotent.test.ts
```

**Un module, un rôle.** `schema.ts` déclare, il ne se connecte pas. `seed.ts` exporte une fonction qui reçoit sa connexion au lieu de l'ouvrir : c'est ce qui permet au test d'idempotence de l'appeler deux fois sans lancer de processus. `seed.cli.ts` est la seule pièce qui lit l'environnement et ouvre une connexion.

### Flux

```
pnpm db:generate     schema.ts            -> migrations/0000_*.sql
(à la main)                               -> migrations/0001_role_etl.sql
pnpm db:migrate      migrations/*.sql     -> base (journal __drizzle_migrations)
pnpm db:seed         seed.ts              -> rôles, comptes de démonstration, mot de passe du rôle etl
pnpm test            testcontainers       -> conteneur -> migrate -> assertions
```

L'ordre `migrate` puis `seed` est une dépendance réelle : l'amorçage pose le `LOGIN PASSWORD` d'un rôle que la migration a créé. Le script échoue avec un message explicite si le rôle n'existe pas, plutôt que de laisser une erreur PostgreSQL brute.

## Composants

### 1. `server/database/schema.ts`

Transcription littérale des cinq tables de `data.md`. Points qui demandent une décision d'écriture :

- **Les noms de colonnes sont écrits explicitement** en `snake_case`, et non déduits par l'option `casing` de Drizzle. Cette option se règle à deux endroits, la configuration de `drizzle-kit` et l'appel `drizzle()`, et se désynchronise sans bruit. Ici le nom de colonne est un contrat avec l'ETL, qui écrit du SQL à la main : il se lit dans le schéma.
- **`gen_random_uuid()` est natif en PostgreSQL 16**, aucune extension à activer. `uuid().defaultRandom()` le produit.
- **Les deux `CHECK`** (`capacity_kw > 0`, `warning_threshold_kw > 0`) passent par `check()` dans la configuration additionnelle de `pgTable`.
- **Les deux index nommés** de `data.md` : `idx_sessions_user` sur `sessions(user_id)` et `idx_user_sites_site` sur `user_sites(site_id)`. Les noms sont ceux du document, parce que le test de conformité les cherche par leur nom.
- **`user_sites`** a une clé primaire composite `(user_id, site_id)`, pas de colonne `id`.
- **Trois politiques `ON DELETE` différentes**, et c'est voulu : `RESTRICT` de `users` vers `roles`, `CASCADE` de `sessions` et `user_sites` vers `users`, `RESTRICT` de `user_sites` vers `sites`.

À vérifier à l'implémentation, avec un repli si l'export n'existe pas dans drizzle-orm 0.45.2 : le type `inet` (repli : `customType`), et `check()` dans la configuration additionnelle de `pgTable`.

### 2. `server/database/migrations/0001_role_etl.sql`

Généré vide par `drizzle-kit generate --custom --name=role_etl`, puis écrit à la main. Contenu :

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') THEN
    CREATE ROLE etl NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO etl;
--> statement-breakpoint
GRANT SELECT, INSERT ON sites TO etl;
--> statement-breakpoint
GRANT UPDATE (name, type, location, capacity_kw, status,
              present_in_source, updated_at) ON sites TO etl;
```

**Le rôle est créé sans mot de passe et sans `LOGIN`.** Un fichier commité ne porte pas de secret, et un rôle qui ne peut pas se connecter tant que personne ne lui a donné de mot de passe est un défaut sûr. C'est l'amorçage qui l'active.

**Le bloc `DO` n'est pas une coquetterie** : les rôles PostgreSQL sont globaux au cluster, pas à la base. La suite de tests crée plusieurs bases dans un même conteneur, donc la migration s'exécute plusieurs fois contre le même cluster et rencontrerait un rôle déjà créé.

**Aucun `REVOKE` n'est nécessaire.** Un rôle fraîchement créé n'a aucun privilège sur les tables : le refus sur `users`, `sessions` et `user_sites` est le comportement par défaut, pas quelque chose qu'on retire. Le test le vérifie quand même, parce que c'est précisément le genre de propriété qu'une modification future casse sans le vouloir.

**Limite connue, à écrire dans la PR** : `CREATE ROLE` demande `CREATEROLE` ou la superutilisation. C'est le cas du compte `POSTGRES_USER` de la composition et du conteneur de test, qui sont superutilisateurs de leur instance. Sur une base managée, cette migration demanderait un compte dédié.

### 3. `server/database/seed.ts`

Signature : `export async function seed(sql: Sql, options: { seedPassword: string, etlPassword: string }): Promise<SeedResult>`.

Trois étapes, toutes idempotentes :

1. **Les trois rôles.** `INSERT INTO roles (name) VALUES ('ADMIN'), ('OPERATOR'), ('VIEWER') ON CONFLICT (name) DO NOTHING`.
2. **Un compte de démonstration par rôle** : `admin@enervision.local`, `operator@enervision.local`, `viewer@enervision.local`. Le `role_id` est résolu par sous-requête sur `roles.name`, jamais écrit en dur. Hachage **Argon2id** avec `@node-rs/argon2`, paramètres `m = 19456`, `t = 2`, `p = 1`, ceux de `data.md` et de la fiche OWASP. Clause `ON CONFLICT (email) DO NOTHING` : c'est elle qui garantit qu'un **mot de passe changé depuis n'est pas écrasé**. Un `DO UPDATE` le remettrait à sa valeur d'usine à chaque passage, ce qui est exactement ce que le critère interdit.
3. **Le mot de passe du rôle `etl`.** PostgreSQL n'accepte pas de paramètre lié dans `ALTER ROLE ... PASSWORD`, et un `DO $$` n'en accepte pas non plus. L'échappement se fait donc côté serveur, puis la commande est exécutée :

```ts
const [{ literal }] = await sql`SELECT quote_literal(${etlPassword}) AS literal`
await sql.unsafe(`ALTER ROLE etl WITH LOGIN PASSWORD ${literal}`)
```

Repositionner le même mot de passe à chaque passage est sans effet observable : cette étape est idempotente au sens qui compte.

**Aucun site, aucune ligne dans `user_sites`.** Le référentiel appartient à l'ETL (#21, fermée). Conséquence à assumer et à écrire dans le README : une démonstration complète demande l'amorçage **et** un passage de l'ETL.

`seed.cli.ts` lit `NUXT_DATABASE_URL`, `SEED_PASSWORD` et `ETL_DB_PASSWORD`, et **s'arrête si l'une manque**. Pas de mot de passe par défaut : un défaut deviné finit en production.

### 4. Les tests

Un conteneur `postgres:16-alpine` pour toute la suite, démarré par `global-setup.ts`. Chaque fichier de test crée sa **propre base** dans ce conteneur (`CREATE DATABASE`) et y applique les migrations : isolation réelle, sans payer un démarrage de conteneur par fichier.

**`schema-conforme-au-document.test.ts`.** Le test central. `data-md.ts` lit `docs/data.md`, repère les cinq sections `### \`<table>\`` et analyse le tableau Markdown qui suit chacune, puis compare à `information_schema` et aux catalogues :

| Ce qui est comparé | Source côté base |
| :--- | :--- |
| Ensemble des colonnes, nom pour nom | `information_schema.columns` |
| Type et longueur | `data_type`, `character_maximum_length` |
| Nullabilité | `is_nullable` |
| Présence d'un défaut | `column_default` |
| Clés primaires, unicité | `information_schema.table_constraints` |
| Clés étrangères et leur `ON DELETE` | `information_schema.referential_constraints` |
| Contraintes `CHECK` | `pg_constraint` |
| Index nommés | `pg_indexes` |

Trois précautions, parce qu'un parseur de Markdown est fragile par nature :

- Le parseur **échoue bruyamment** s'il ne trouve pas exactement cinq tables, ou si une table n'a aucune colonne. Un test de conformité qui passe à vide est pire que pas de test.
- La colonne « Origine », présente pour `sites` seule, est tolérée : le parseur travaille sur les en-têtes `Colonne`, `Type` et `Contraintes`, par leur nom, pas par leur position.
- La nullabilité se lit avec des frontières de mot : `NOT NULL` contient `NULL`, et la lecture naïve rendrait toute colonne nullable.

Les types du document sont normalisés vers ceux de PostgreSQL : `SERIAL` vers `integer` avec défaut, `TIMESTAMPTZ` vers `timestamp with time zone`, `VARCHAR(n)` vers `character varying` de longueur `n`, `UUID`, `INTEGER`, `BOOLEAN` et `INET` inchangés.

**`migration-rejouable.test.ts`.** Applique les migrations, relève le contenu de `__drizzle_migrations`, applique de nouveau, et vérifie que rien n'a échoué et que le journal n'a pas bougé. C'est le critère d'origine de #26.

**`role-etl-moindre-privilege.test.ts`.** Ouvre une seconde connexion **en tant que `etl`**, après lui avoir donné un mot de passe de test. Ce qui doit passer :

- `SELECT id FROM sites`
- `INSERT INTO sites (id, name, type, capacity_kw, status) VALUES (...)`
- `UPDATE sites SET name, type, location, capacity_kw, status, present_in_source, updated_at`

Ce qui doit être **refusé**, avec le code SQLSTATE `42501` :

- `SELECT * FROM users`
- `SELECT * FROM sessions`
- `SELECT * FROM user_sites`
- `UPDATE sites SET warning_threshold_kw = ...`
- `DELETE FROM sites`
- `INSERT INTO roles (name) VALUES (...)`

Le test attend le code d'erreur, pas seulement « une erreur » : une faute de frappe dans un nom de table lèverait aussi, et le test passerait pour de mauvaises raisons.

**`amorcage-idempotent.test.ts`.** Trois passages. Après deux `seed`, trois rôles et trois comptes, pas six. Puis on change le hachage d'un compte à la main, on relance `seed`, et on vérifie que le hachage modifié **est toujours là**. C'est la partie du critère qu'un `ON CONFLICT DO UPDATE` casserait sans qu'aucun compte ne soit dupliqué.

## Modifications hors du périmètre strict, et pourquoi

Quatre changements que le ticket n'énonce pas mais sans lesquels il ne tient pas.

| Fichier | Changement | Pourquoi maintenant |
| :--- | :--- | :--- |
| `apps/dashboard/pnpm-workspace.yaml` | Ajouter le champ `packages` | Le fichier n'en a pas, et pnpm 10.12 et au-delà refusent d'installer : `ERROR packages field missing or empty`. Rencontré à l'installation des dépendances de cette branche |
| `apps/dashboard/package.json` | `test` devient `vitest run`, ajout de `test:watch`, `db:seed` | La CI appelle `pnpm test` et resterait bloquée sur le mode observateur de Vitest |
| `.github/workflows/ci.yml` | Décommenter le job `dashboard`, `pnpm/action-setup` épinglé en **10.11.0**, Node **22** | Le lockfile existe désormais. Sans ce job, aucun de ces tests ne tourne jamais en intégration, et le critère « vérifié, pas supposé » redevient déclaratif. La version 9 du commentaire d'origine ne lit pas ce lockfile, et Vitest 5 demande Node 20.19 au minimum, donc 22 plutôt qu'une résolution de 20 au petit bonheur |
| `docker-compose.yml` | Le bloc commenté du service `etl` passe à `POSTGRES_USER: etl` et `POSTGRES_PASSWORD: ${ETL_DB_PASSWORD:?}` | Le bloc actuel donne au conteneur ETL le compte propriétaire de la base, ce qui annule le cloisonnement que ce ticket met en place. Le service est encore commenté, donc c'est le bon moment |

`.github/` et `docker-compose.yml` ont leurs propres propriétaires dans `CODEOWNERS` : la PR les signale explicitement.

## Variables d'environnement

Ajouts à `.env.example`, toutes sans valeur :

| Variable | Pour qui | Note |
| :--- | :--- | :--- |
| `NUXT_DATABASE_URL` | L'applicatif et `drizzle-kit` | Le préfixe `NUXT_` est la convention Nuxt pour alimenter `runtimeConfig.databaseUrl`, déjà déclaré dans `nuxt.config.ts`. `drizzle.config.ts` la lit déjà, mais elle n'était déclarée nulle part |
| `ETL_DB_PASSWORD` | Le rôle `etl` | Valeur chiffrée par SOPS dans #52. Jamais en clair |
| `SEED_PASSWORD` | Les comptes de démonstration | Sans elle, l'amorçage s'arrête |

## Documents à mettre à jour, dans la même PR

- **`docs/data.md`** : la phrase « Le SQL généré est commité (`drizzle/0000_*.sql`) » désigne un chemin qui n'est pas celui du `drizzle.config.ts` déjà sur `main`. Corriger vers `apps/dashboard/server/database/migrations/`. Et la phrase de l'amorçage annonce « les trois rôles, les sept sites, et trois comptes de démonstration » : elle devient les trois rôles et les trois comptes, avec le motif (les attributs des sites ne sont pas connus, et l'ETL ne corrige pas une ligne existante). Ajouter que le rôle `etl` est créé sans `LOGIN` par la migration et activé par l'amorçage.
- **`apps/dashboard/README.md`** : la marche à suivre, `db:generate`, `db:migrate`, `db:seed`, `test`, et le fait que **Docker doit tourner** pour lancer les tests.
- **`docs/README.md`** : une ligne pour dire que `docs/superpowers/specs/` porte les conceptions validées, afin que le répertoire ne soit pas une surprise.

## Ce que ce ticket ne fait pas

Aucune logique d'authentification (#29), d'autorisation ni de `sitesAutorises()` (#95), aucun seuil par défaut à 80 % de `capacity_kw` (#43), aucun site amorcé (#21, fermée, c'est l'ETL), aucune valeur chiffrée SOPS (#52), et aucun changement de l'ETL : `sites_repository.py` reste tel quel, le rôle `etl` a exactement les droits dont son code actuel a besoin.

## Risques

| Risque | Parade |
| :--- | :--- |
| `inet` ou `check()` absents de drizzle-orm 0.45.2 | Vérifié à la première étape d'implémentation. Repli `customType` pour `inet`, `sql` brut dans la migration custom pour un `CHECK` |
| Le parseur de `data.md` passe à vide après une reformulation du document | Il échoue s'il ne trouve pas cinq tables, ou si une table est vide |
| Testcontainers demande Docker sur le poste | Écrit dans le README. Sur `ubuntu-latest`, Docker est présent |
| Le démarrage du conteneur dépasse le délai de Vitest | Un seul conteneur pour la suite, `testTimeout` et `hookTimeout` portés à 120 s |
| La migration `0001` échoue sur une base managée, faute de `CREATEROLE` | Écrit dans la PR et dans `data.md`. Sans objet sur la machine du projet |
