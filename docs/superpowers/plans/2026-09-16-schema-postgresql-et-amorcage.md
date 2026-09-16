# Schéma PostgreSQL et amorçage : plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE. Utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les étapes sont des cases à cocher (`- [ ]`).

**But :** créer les cinq tables de `docs/data.md` en Drizzle, le rôle PostgreSQL `etl` à droits bornés par colonne, un script d'amorçage idempotent, et les tests qui prouvent les trois.

**Architecture :** le schéma TypeScript de `apps/dashboard/server/database/schema.ts` est la source de vérité. `drizzle-kit generate` en tire `0000_*.sql`, commité. Une migration « custom » écrite à la main, `0001_role_etl.sql`, pose le rôle `etl` et ses `GRANT` par colonne, que Drizzle ne sait pas générer. Le script d'amorçage active ce rôle et crée les trois rôles applicatifs et trois comptes de démonstration. Les tests tournent contre un vrai PostgreSQL démarré par Testcontainers, une base jetable par fichier de test.

**Pile :** Nuxt 4, drizzle-orm 0.45.2, drizzle-kit 0.31.10, postgres-js 3.4.9, Vitest 5, `@testcontainers/postgresql` 12, `@node-rs/argon2` 2, pnpm 10.11, PostgreSQL 16.

**Spec :** [`docs/superpowers/specs/2026-09-16-schema-postgresql-et-amorcage-design.md`](../specs/2026-09-16-schema-postgresql-et-amorcage-design.md)

## Contraintes globales

Elles s'appliquent à **toutes** les tâches.

- **`docs/data.md` est la référence du modèle.** Aucune tâche ne modifie un type, une contrainte ou un nom de colonne pour se simplifier la vie. Si le code et le document divergent, c'est le code qui a tort, sauf décision tracée dans la même PR.
- **Français accentué partout** : commentaires de code, messages de commit, documentation. Les identifiants techniques, noms de tables, de colonnes et de routes restent en anglais.
- **Pas de tiret cadratin ni de double tiret dans les textes** : deux points, parenthèses, ou une phrase de plus. Sans objet dans le code (`--custom`, `--> statement-breakpoint` sont de la syntaxe).
- **Commits en conventional commits, préfixe `chore`**, comme la branche `EADL_2025_NANTES_G1/chore-126-schema-postgresql-et-amorcage`. Le message dit **pourquoi**. **Aucun trailer d'attribution d'outil** : l'historique reste nominatif (`CLAUDE.md`).
- **Aucune suppression définitive de fichier.** Sur Windows, passer par la corbeille, et seulement après avoir vérifié que le contenu est suivi par git.
- **Toutes les commandes `pnpm` passent par `corepack pnpm@10.11.0`** depuis `apps/dashboard/`. La version par défaut de corepack refuse le `pnpm-workspace.yaml` du dépôt tant que la tâche 1 n'est pas faite, et `pnpm` n'est pas sur le `PATH`.
- **Docker doit tourner** pour lancer les tests, à partir de la tâche 1.
- **Argon2id, paramètres figés** : `m = 19456`, `t = 2`, `p = 1`. Jamais bcrypt, jamais scrypt.
- **Aucun secret en clair**, ni dans un fichier commité, ni dans un message de commit.

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
| :--- | :--- | :--- |
| `apps/dashboard/pnpm-workspace.yaml` | Débloquer l'installation sous pnpm 10.12 et au-delà | 1 |
| `apps/dashboard/package.json` | Dépendances et scripts `test`, `test:watch`, `db:seed` | 1, 6 |
| `apps/dashboard/vitest.config.ts` | Amorce globale et délais adaptés au démarrage d'un conteneur | 1 |
| `apps/dashboard/tests/database/global-setup.ts` | Un conteneur PostgreSQL pour toute la suite, et son arrêt | 1 |
| `apps/dashboard/tests/database/base-de-test.ts` | Une base jetable migrée par fichier de test | 1 |
| `apps/dashboard/server/database/schema.ts` | Les cinq tables. Source de vérité du schéma | 2 |
| `apps/dashboard/server/database/migrations/0000_*.sql` | DDL généré, commité | 2 |
| `apps/dashboard/server/database/migrations/0001_role_etl.sql` | Rôle `etl` et ses `GRANT` par colonne | 4 |
| `apps/dashboard/tests/database/data-md.ts` | Lit et analyse les cinq tableaux de `docs/data.md` | 3 |
| `apps/dashboard/tests/database/*.test.ts` | Les quatre familles de vérification | 1 à 6 |
| `apps/dashboard/server/database/seed.ts` | `amorcer(sql, options)`, sans connexion ni environnement | 6 |
| `apps/dashboard/server/database/seed.cli.ts` | Seul point qui lit l'environnement et ouvre une connexion | 6 |
| `.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml` | Câblage | 7 |
| `docs/data.md`, `apps/dashboard/README.md`, `docs/README.md` | Documents remis d'accord avec le code | 8 |

---

## Tâche 1 : socle de test jetable

Sans base réelle, aucun des critères du ticket n'est vérifiable. Cette tâche livre un conteneur partagé et une base jetable par fichier de test, et le prouve par un test qui s'y connecte.

**Fichiers :**
- Modifier : `apps/dashboard/pnpm-workspace.yaml`
- Modifier : `apps/dashboard/package.json`
- Modifier : `apps/dashboard/vitest.config.ts`
- Créer : `apps/dashboard/tests/database/global-setup.ts`
- Créer : `apps/dashboard/tests/database/base-de-test.ts`
- Créer : `apps/dashboard/tests/database/socle.test.ts`

**Interfaces :**
- Consomme : rien.
- Produit : `creerBaseDeTest(options?: { migrer?: boolean }): Promise<BaseDeTest>` où `interface BaseDeTest { url: string; sql: Sql; fermer: () => Promise<void> }`. Par défaut les migrations sont appliquées ; `{ migrer: false }` rend une base vide. La clé injectée `urlAdministrateur` porte l'URL de connexion du conteneur.

- [ ] **Étape 1 : réparer l'espace de travail pnpm**

`apps/dashboard/pnpm-workspace.yaml` n'a pas de champ `packages`, et pnpm 10.12 et au-delà refusent d'installer avec `ERROR packages field missing or empty`. Ajouter en tête du fichier, sans toucher au reste :

```yaml
# pnpm exige ce champ dès la 10.12, même pour un dépôt à un seul paquet :
# sans lui, l'installation échoue avant de lire quoi que ce soit d'autre.
packages:
  - .

allowBuilds:
  esbuild: true
  'true': true
  unrs-resolver: true
  vue-demi: true
```

- [ ] **Étape 2 : ajouter les dépendances**

Depuis `apps/dashboard/` :

```bash
corepack pnpm@10.11.0 add -D @testcontainers/postgresql@^12.1.0 tsx@^4.23.13
```

Attendu : `pnpm-lock.yaml` modifié. Vérifier ensuite que le lockfile reste utilisable en mode figé, puisque la CI de la tâche 7 s'appuie dessus :

```bash
corepack pnpm@10.11.0 install --frozen-lockfile
```

Attendu : installation sans erreur. Si elle échoue, relancer `corepack pnpm@10.11.0 install` et commiter le lockfile régénéré.

- [ ] **Étape 3 : écrire le test qui échoue**

Créer `apps/dashboard/tests/database/socle.test.ts` :

```ts
import { afterAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'

describe('socle de test', () => {
  const basesOuvertes: BaseDeTest[] = []

  afterAll(async () => {
    await Promise.all(basesOuvertes.map(base => base.fermer()))
  })

  it('rend une base jetable joignable', async () => {
    const base = await creerBaseDeTest({ migrer: false })
    basesOuvertes.push(base)

    const [ligne] = await base.sql<{ un: number }[]>`SELECT 1 AS un`
    expect(ligne.un).toBe(1)
  })

  it('isole deux bases l une de l autre', async () => {
    const premiere = await creerBaseDeTest({ migrer: false })
    const seconde = await creerBaseDeTest({ migrer: false })
    basesOuvertes.push(premiere, seconde)

    await premiere.sql`CREATE TABLE marqueur (id integer)`

    const [{ existe }] = await seconde.sql<{ existe: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'marqueur'
      ) AS existe
    `
    expect(existe).toBe(false)
  })
})
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il échoue**

```bash
corepack pnpm@10.11.0 vitest run tests/database/socle.test.ts
```

Attendu : ÉCHEC, `Failed to resolve import "./base-de-test"`.

- [ ] **Étape 5 : écrire l'amorce globale**

Créer `apps/dashboard/tests/database/global-setup.ts` :

```ts
// Un seul conteneur PostgreSQL pour toute la suite : chaque fichier de test
// crée sa propre BASE dedans, ce qui isole sans payer un démarrage de
// conteneur par fichier.
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  interface ProvidedContext {
    urlAdministrateur: string
  }
}

let conteneur: StartedPostgreSqlContainer | undefined

export async function setup(projet: TestProject) {
  conteneur = await new PostgreSqlContainer('postgres:16-alpine').start()
  projet.provide('urlAdministrateur', conteneur.getConnectionUri())
}

export async function teardown() {
  await conteneur?.stop()
}
```

- [ ] **Étape 6 : écrire la fabrique de base jetable**

Créer `apps/dashboard/tests/database/base-de-test.ts` :

```ts
import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { inject } from 'vitest'

export const DOSSIER_MIGRATIONS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../server/database/migrations'
)

export interface BaseDeTest {
  url: string
  sql: postgres.Sql
  fermer: () => Promise<void>
}

export async function creerBaseDeTest(
  options: { migrer?: boolean } = {}
): Promise<BaseDeTest> {
  const urlAdministrateur = inject('urlAdministrateur')
  // Un nom de base ne peut pas porter de tiret sans être cité : on les retire.
  const nom = `test_${randomUUID().replaceAll('-', '')}`

  // CREATE DATABASE refuse de s'exécuter dans une transaction, d'où `unsafe`.
  const administrateur = postgres(urlAdministrateur, { max: 1 })
  await administrateur.unsafe(`CREATE DATABASE ${nom}`)
  await administrateur.end()

  const url = new URL(urlAdministrateur)
  url.pathname = `/${nom}`
  const sql = postgres(url.toString(), { max: 1 })

  if (options.migrer !== false) {
    await migrate(drizzle(sql), { migrationsFolder: DOSSIER_MIGRATIONS })
  }

  return { url: url.toString(), sql, fermer: () => sql.end() }
}
```

- [ ] **Étape 7 : câbler Vitest**

Remplacer `apps/dashboard/vitest.config.ts` :

```ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    globalSetup: ['./tests/database/global-setup.ts'],
    // Le premier démarrage tire l'image postgres:16-alpine : large, et une
    // seule fois. Les délais par défaut de Vitest sont de 5 s.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Un fichier de test à la fois. Chaque fichier a sa propre BASE, donc les
    // tables sont isolées, mais un ROLE PostgreSQL est global au cluster : deux
    // fichiers qui posent chacun un mot de passe au rôle etl se marcheraient
    // dessus, et l'échec serait intermittent, donc long à diagnostiquer.
    fileParallelism: false
  }
})
```

Et dans `apps/dashboard/package.json`, remplacer le script `test` et en ajouter un :

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

Le mode observateur de Vitest ne rend jamais la main : la CI de la tâche 7 appelle `pnpm test` et resterait bloquée.

- [ ] **Étape 8 : lancer les tests et vérifier qu'ils passent**

```bash
corepack pnpm@10.11.0 test
```

Attendu : SUCCÈS, 3 tests (celui de `tests/app.test.ts` et les deux du socle).

- [ ] **Étape 9 : commiter**

```bash
git add apps/dashboard/pnpm-workspace.yaml apps/dashboard/package.json \
        apps/dashboard/pnpm-lock.yaml apps/dashboard/vitest.config.ts \
        apps/dashboard/tests/database/
git commit -F - <<'EOF'
chore(db): donner aux tests une vraie base, jetable et isolée

Les trois critères du ticket qui comptent (migration rejouable, refus de
privilège, schéma conforme au document) ne se vérifient pas sans base
réelle. Testcontainers évite d'avoir deux chemins à maintenir, un pour la
CI et un pour les postes, et une commande unique suffit des deux côtés.

Le champ packages du fichier d'espace de travail manquait : pnpm 10.12 et
au-delà refusent d'installer sans lui.
EOF
```

---

## Tâche 2 : les cinq tables et leur migration générée

**Fichiers :**
- Modifier : `apps/dashboard/server/database/schema.ts` (contient `export {}`)
- Créer : `apps/dashboard/server/database/migrations/0000_*.sql` (généré)
- Créer : `apps/dashboard/tests/database/schema-applique.test.ts`

**Interfaces :**
- Consomme : `creerBaseDeTest` de la tâche 1.
- Produit : les exports `roles`, `users`, `sessions`, `sites`, `userSites` de `server/database/schema.ts`. Les noms de colonnes en base sont ceux de `data.md` ; les propriétés TypeScript sont en `camelCase` (`roleId`, `capacityKw`, `presentInSource`, `warningThresholdKw`, `passwordHash`, `lastLogin`, `isActive`, `createdAt`, `updatedAt`, `expiresAt`, `revokedAt`, `userId`, `siteId`).

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `apps/dashboard/tests/database/schema-applique.test.ts` :

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'

const TABLES = ['roles', 'users', 'sessions', 'sites', 'user_sites']

describe('schéma appliqué', () => {
  let base: BaseDeTest

  beforeAll(async () => {
    base = await creerBaseDeTest()
  })

  afterAll(async () => {
    await base?.fermer()
  })

  it('crée les cinq tables', async () => {
    const lignes = await base.sql<{ table_name: string }[]>`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name
    `
    expect(lignes.map(l => l.table_name)).toEqual([...TABLES].sort())
  })

  it('donne à user_sites une clé primaire composite', async () => {
    const lignes = await base.sql<{ column_name: string }[]>`
      SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
       WHERE tc.table_name = 'user_sites' AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.column_name
    `
    expect(lignes.map(l => l.column_name)).toEqual(['site_id', 'user_id'])
  })

  it('pose les deux index nommés par le document', async () => {
    const lignes = await base.sql<{ indexname: string }[]>`
      SELECT indexname
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN ('idx_sessions_user', 'idx_user_sites_site')
       ORDER BY indexname
    `
    expect(lignes.map(l => l.indexname)).toEqual([
      'idx_sessions_user',
      'idx_user_sites_site'
    ])
  })

  it('refuse une capacité nulle ou négative', async () => {
    await expect(base.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE999', 'Essai', 'office', 0, 'active')
    `).rejects.toMatchObject({ code: '23514' })
  })
})
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
corepack pnpm@10.11.0 vitest run tests/database/schema-applique.test.ts
```

Attendu : ÉCHEC. Le dossier de migrations n'existe pas encore, donc `migrate` lève avant même les assertions.

- [ ] **Étape 3 : écrire le schéma**

Remplacer tout le contenu de `apps/dashboard/server/database/schema.ts` :

```ts
// Source de vérité du schéma PostgreSQL, propriété de l'applicatif et de lui
// seul : l'ETL écrit des lignes dans `sites`, jamais du DDL (docs/data.md).
//
// Transcription littérale des cinq tables de docs/data.md. Toute différence
// entre ce fichier et le document est un défaut, et
// tests/database/schema-conforme-au-document.test.ts la fait échouer.
//
// Les noms de colonnes sont écrits explicitement plutôt que déduits par
// l'option `casing` de Drizzle : cette option se règle à deux endroits, la
// configuration de drizzle-kit et l'appel drizzle(), et se désynchronise sans
// bruit. Or ces noms sont un contrat avec l'ETL, qui écrit du SQL à la main.
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  inet,
  integer,
  pgTable,
  primaryKey,
  serial,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

// Profils d'accès globaux. Trois lignes, posées par l'amorçage, jamais créées
// par l'application.
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique()
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // RESTRICT et non CASCADE : supprimer un rôle ne doit pas emporter ses
  // comptes en silence.
  roleId: integer('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'restrict' }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // Empreinte Argon2id, forme encodée `$argon2id$...`. Une centaine de
  // caractères suffit, paramètres et sel compris.
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  lastLogin: timestamp('last_login', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// L'état des sessions ouvertes : le cookie ne porte que `id`, tout le reste
// vit ici, et c'est ce qui rend la révocation possible (#29).
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ip: inet('ip')
  },
  t => [index('idx_sessions_user').on(t.userId)]
)

// Référentiel des installations. `id` est la clé de la source et celle du
// chemin de partition Parquet : c'est le pivot entre les deux stockages.
export const sites = pgTable(
  'sites',
  {
    id: varchar('id', { length: 16 }).primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    location: varchar('location', { length: 100 }),
    capacityKw: integer('capacity_kw').notNull(),
    status: varchar('status', { length: 30 }).notNull(),
    // Passe à FALSE quand le site disparaît de l'API : une suppression
    // casserait le rattachement des mesures Parquet déjà écrites.
    presentInSource: boolean('present_in_source').notNull().default(true),
    // NULL ne veut pas dire « pas de vigilance » mais « règle par défaut »,
    // 80 % de capacity_kw. La règle appartient à #43, pas au schéma.
    warningThresholdKw: integer('warning_threshold_kw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  t => [
    check('sites_capacity_kw_positive', sql`${t.capacityKw} > 0`),
    check('sites_warning_threshold_kw_positive', sql`${t.warningThresholdKw} > 0`)
  ]
)

// Périmètre d'accès, site par site. Une ligne oubliée donne zéro accès au lieu
// de tout, et c'est le motif du choix de cette table contre un tableau.
export const userSites = pgTable(
  'user_sites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // RESTRICT et non CASCADE : un site n'est de toute façon jamais supprimé,
    // et un CASCADE ferait disparaître des droits en silence.
    siteId: varchar('site_id', { length: 16 })
      .notNull()
      .references(() => sites.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  t => [
    primaryKey({ columns: [t.userId, t.siteId] }),
    index('idx_user_sites_site').on(t.siteId)
  ]
)
```

- [ ] **Étape 4 : générer la migration**

```bash
corepack pnpm@10.11.0 db:generate
```

Attendu : création de `server/database/migrations/0000_<adjectif>_<nom>.sql` et du dossier `meta/`. Ouvrir le fichier et **relire le DDL** : cinq `CREATE TABLE`, deux `CREATE INDEX`, les deux contraintes `CHECK`, et les **quatre** clés étrangères avec leur `ON DELETE` (`users.role_id`, `sessions.user_id`, `user_sites.user_id`, `user_sites.site_id`).

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

```bash
corepack pnpm@10.11.0 vitest run tests/database/schema-applique.test.ts
```

Attendu : SUCCÈS, 4 tests.

- [ ] **Étape 6 : vérifier le typage et le lint**

```bash
corepack pnpm@10.11.0 lint
```

Attendu : aucune erreur.

- [ ] **Étape 7 : commiter**

```bash
git add apps/dashboard/server/database/schema.ts \
        apps/dashboard/server/database/migrations/ \
        apps/dashboard/tests/database/schema-applique.test.ts
git commit -F - <<'EOF'
chore(db): écrire les cinq tables figées par data.md

Le modèle était figé depuis le 15 septembre et la base était vide : #29,
#95 et le reste de l'applicatif attendaient ce socle pour démarrer.

Le SQL généré est commité, comme le veut la décision qui a préféré Drizzle
à un init.sql : le schéma doit se relire sans connaître l'ORM, et une revue
doit pouvoir porter sur du DDL.
EOF
```

---

## Tâche 3 : le test qui compare le schéma au document

C'est le test qui empêche `data.md` et la base de diverger. Sans lui, les deux se séparent en trois jours et personne ne s'en aperçoit.

**Fichiers :**
- Créer : `apps/dashboard/tests/database/data-md.ts`
- Créer : `apps/dashboard/tests/database/data-md.test.ts`
- Créer : `apps/dashboard/tests/database/schema-conforme-au-document.test.ts`

**Interfaces :**
- Consomme : `creerBaseDeTest` de la tâche 1, le schéma de la tâche 2.
- Produit : `lireTablesDocumentees(): Map<string, TableDocumentee>` et `typePostgres(typeDocumente: string): { dataType: string, longueur: number | null }`, avec `interface ColonneDocumentee { nom: string; type: string; contraintes: string; nullable: boolean; aUnDefaut: boolean }` et `interface TableDocumentee { nom: string; colonnes: ColonneDocumentee[] }`.

- [ ] **Étape 1 : écrire le test du parseur, qui échoue**

Créer `apps/dashboard/tests/database/data-md.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { lireTablesDocumentees, typePostgres } from './data-md'

describe('lecture de docs/data.md', () => {
  const tables = lireTablesDocumentees()

  it('trouve les cinq tables', () => {
    expect([...tables.keys()].sort()).toEqual([
      'roles',
      'sessions',
      'sites',
      'user_sites',
      'users'
    ])
  })

  it('lit les colonnes de roles', () => {
    expect(tables.get('roles')!.colonnes.map(c => c.nom)).toEqual(['id', 'name'])
  })

  it('tolère la colonne « Origine », présente pour sites seule', () => {
    expect(tables.get('sites')!.colonnes.map(c => c.nom)).toEqual([
      'id',
      'name',
      'type',
      'location',
      'capacity_kw',
      'status',
      'present_in_source',
      'warning_threshold_kw',
      'created_at',
      'updated_at'
    ])
  })

  it('ne confond pas NOT NULL avec NULL', () => {
    const colonnes = tables.get('users')!.colonnes
    expect(colonnes.find(c => c.nom === 'is_active')!.nullable).toBe(false)
    expect(colonnes.find(c => c.nom === 'last_login')!.nullable).toBe(true)
  })

  it('repère les valeurs par défaut, SERIAL compris', () => {
    expect(tables.get('roles')!.colonnes.find(c => c.nom === 'id')!.aUnDefaut).toBe(true)
    expect(tables.get('roles')!.colonnes.find(c => c.nom === 'name')!.aUnDefaut).toBe(false)
    expect(tables.get('users')!.colonnes.find(c => c.nom === 'id')!.aUnDefaut).toBe(true)
  })

  it('traduit les types du document vers ceux de PostgreSQL', () => {
    expect(typePostgres('VARCHAR(50)')).toEqual({
      dataType: 'character varying',
      longueur: 50
    })
    expect(typePostgres('TIMESTAMPTZ')).toEqual({
      dataType: 'timestamp with time zone',
      longueur: null
    })
    expect(typePostgres('SERIAL')).toEqual({ dataType: 'integer', longueur: null })
    expect(() => typePostgres('JSONB')).toThrow(/JSONB/)
  })
})
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
corepack pnpm@10.11.0 vitest run tests/database/data-md.test.ts
```

Attendu : ÉCHEC, `Failed to resolve import "./data-md"`.

- [ ] **Étape 3 : écrire le parseur**

Créer `apps/dashboard/tests/database/data-md.ts` :

```ts
// Lit docs/data.md et en extrait les cinq tableaux de colonnes, pour que le
// document devienne vérifiable au lieu d'être seulement lu.
//
// Un parseur de Markdown est fragile par nature : celui-ci échoue bruyamment
// s'il ne trouve pas ce qu'il attend, parce qu'un test de conformité qui passe
// à vide est pire que pas de test du tout.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CHEMIN_DATA_MD = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/data.md'
)

const TABLES_ATTENDUES = ['roles', 'users', 'sessions', 'sites', 'user_sites'] as const

export interface ColonneDocumentee {
  nom: string
  type: string
  contraintes: string
  nullable: boolean
  aUnDefaut: boolean
}

export interface TableDocumentee {
  nom: string
  colonnes: ColonneDocumentee[]
}

function cellules(ligne: string): string[] {
  const brut = ligne.trim()
  const sansBordures = brut.slice(1, brut.endsWith('|') ? -1 : undefined)
  return sansBordures.split('|').map(cellule => cellule.trim())
}

function sansAccentsGraves(valeur: string): string {
  return valeur.replaceAll('`', '').trim()
}

function estSeparateur(ligne: string): boolean {
  return /^\|[\s:|-]+\|?\s*$/.test(ligne.trim())
}

function lireTable(lignes: string[], nom: string): TableDocumentee {
  const debut = lignes.findIndex(ligne => ligne.trim() === `### \`${nom}\``)
  if (debut === -1) {
    throw new Error(`Section « ### \`${nom}\` » introuvable dans ${CHEMIN_DATA_MD}`)
  }

  const entete = lignes.findIndex(
    (ligne, index) => index > debut && ligne.trim().startsWith('|')
  )
  if (entete === -1) {
    throw new Error(`Aucun tableau après la section de la table ${nom}`)
  }

  const titres = cellules(lignes[entete]!).map(sansAccentsGraves)
  const indexNom = titres.indexOf('Colonne')
  const indexType = titres.indexOf('Type')
  const indexContraintes = titres.indexOf('Contraintes')
  if (indexNom === -1 || indexType === -1 || indexContraintes === -1) {
    throw new Error(
      `Le tableau de ${nom} n'a pas les en-têtes attendus : ${titres.join(', ')}`
    )
  }

  const colonnes: ColonneDocumentee[] = []
  for (let index = entete + 1; index < lignes.length; index += 1) {
    const ligne = lignes[index]!
    if (!ligne.trim().startsWith('|')) break
    if (estSeparateur(ligne)) continue

    const valeurs = cellules(ligne)
    const contraintes = sansAccentsGraves(valeurs[indexContraintes] ?? '')
    const type = sansAccentsGraves(valeurs[indexType] ?? '')
    // Frontières de mot obligatoires : « NOT NULL » contient « NULL », et la
    // lecture naïve rendrait toute colonne nullable.
    const nonNul = /\bNOT NULL\b/i.test(contraintes) || /\bPRIMARY KEY\b/i.test(contraintes)

    colonnes.push({
      nom: sansAccentsGraves(valeurs[indexNom] ?? ''),
      type,
      contraintes,
      nullable: !nonNul,
      aUnDefaut: /\bDEFAULT\b/i.test(contraintes) || type.toUpperCase() === 'SERIAL'
    })
  }

  if (colonnes.length === 0) {
    throw new Error(`Le tableau de ${nom} n'a aucune colonne`)
  }
  return { nom, colonnes }
}

export function lireTablesDocumentees(): Map<string, TableDocumentee> {
  const lignes = readFileSync(CHEMIN_DATA_MD, 'utf8').split(/\r?\n/)
  const tables = new Map<string, TableDocumentee>()
  for (const nom of TABLES_ATTENDUES) {
    tables.set(nom, lireTable(lignes, nom))
  }
  if (tables.size !== TABLES_ATTENDUES.length) {
    throw new Error(
      `${tables.size} table(s) lue(s) dans data.md, ${TABLES_ATTENDUES.length} attendues`
    )
  }
  return tables
}

export function typePostgres(
  typeDocumente: string
): { dataType: string, longueur: number | null } {
  const type = typeDocumente.trim().toUpperCase()

  const varchar = /^VARCHAR\((\d+)\)$/.exec(type)
  if (varchar) {
    return { dataType: 'character varying', longueur: Number(varchar[1]) }
  }

  switch (type) {
    case 'SERIAL':
    case 'INTEGER':
      return { dataType: 'integer', longueur: null }
    case 'UUID':
      return { dataType: 'uuid', longueur: null }
    case 'BOOLEAN':
      return { dataType: 'boolean', longueur: null }
    case 'INET':
      return { dataType: 'inet', longueur: null }
    case 'TIMESTAMPTZ':
      return { dataType: 'timestamp with time zone', longueur: null }
    default:
      throw new Error(`Type non pris en charge dans data.md : ${typeDocumente}`)
  }
}
```

- [ ] **Étape 4 : lancer le test du parseur et vérifier qu'il passe**

```bash
corepack pnpm@10.11.0 vitest run tests/database/data-md.test.ts
```

Attendu : SUCCÈS, 6 tests.

- [ ] **Étape 5 : écrire le test de conformité, qui échoue**

Créer `apps/dashboard/tests/database/schema-conforme-au-document.test.ts` :

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'
import { lireTablesDocumentees, typePostgres } from './data-md'

interface ColonneEnBase {
  column_name: string
  data_type: string
  character_maximum_length: number | null
  is_nullable: 'YES' | 'NO'
  column_default: string | null
}

describe('le schéma appliqué correspond à docs/data.md', () => {
  const documentees = lireTablesDocumentees()
  let base: BaseDeTest

  beforeAll(async () => {
    base = await creerBaseDeTest()
  })

  afterAll(async () => {
    await base?.fermer()
  })

  for (const [nomTable, table] of documentees) {
    describe(nomTable, () => {
      let enBase: Map<string, ColonneEnBase>

      beforeAll(async () => {
        const lignes = await base.sql<ColonneEnBase[]>`
          SELECT column_name, data_type, character_maximum_length,
                 is_nullable, column_default
            FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = ${nomTable}
           ORDER BY ordinal_position
        `
        enBase = new Map(lignes.map(ligne => [ligne.column_name, ligne]))
      })

      it('a exactement les colonnes du document', () => {
        expect([...enBase.keys()].sort()).toEqual(
          table.colonnes.map(c => c.nom).sort()
        )
      })

      for (const colonne of table.colonnes) {
        it(`${colonne.nom} : type, nullabilité et défaut`, () => {
          const reelle = enBase.get(colonne.nom)
          expect(reelle, `colonne ${colonne.nom} absente de la base`).toBeDefined()

          const attendu = typePostgres(colonne.type)
          expect(reelle!.data_type).toBe(attendu.dataType)
          expect(reelle!.character_maximum_length).toBe(attendu.longueur)
          expect(reelle!.is_nullable).toBe(colonne.nullable ? 'YES' : 'NO')
          expect(reelle!.column_default !== null).toBe(colonne.aUnDefaut)
        })
      }
    })
  }

  it('respecte les clés étrangères et leur ON DELETE', async () => {
    const lignes = await base.sql<{
      table_name: string
      column_name: string
      foreign_table_name: string
      delete_rule: string
    }[]>`
      SELECT tc.table_name,
             kcu.column_name,
             ccu.table_name AS foreign_table_name,
             rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints rc
          ON rc.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.column_name
    `

    expect(lignes.map(l => [l.table_name, l.column_name, l.foreign_table_name, l.delete_rule])).toEqual([
      ['sessions', 'user_id', 'users', 'CASCADE'],
      ['user_sites', 'site_id', 'sites', 'RESTRICT'],
      ['user_sites', 'user_id', 'users', 'CASCADE'],
      ['users', 'role_id', 'roles', 'RESTRICT']
    ])
  })

  it('pose les contraintes UNIQUE du document', async () => {
    const lignes = await base.sql<{ table_name: string, column_name: string }[]>`
      SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.column_name
    `
    expect(lignes.map(l => [l.table_name, l.column_name])).toEqual([
      ['roles', 'name'],
      ['users', 'email']
    ])
  })

  it('pose les deux CHECK du document sur sites', async () => {
    const lignes = await base.sql<{ definition: string }[]>`
      SELECT pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
       WHERE c.contype = 'c' AND t.relname = 'sites'
       ORDER BY definition
    `
    const definitions = lignes.map(l => l.definition.replaceAll('"', ''))
    expect(definitions.some(d => /capacity_kw > 0/.test(d))).toBe(true)
    expect(definitions.some(d => /warning_threshold_kw > 0/.test(d))).toBe(true)
  })
})
```

- [ ] **Étape 6 : lancer le test et le faire passer**

```bash
corepack pnpm@10.11.0 vitest run tests/database/schema-conforme-au-document.test.ts
```

Attendu : SUCCÈS. **En cas d'échec, c'est le schéma qui a tort, pas le document.** Corriger `server/database/schema.ts`, puis régénérer la migration `0000` plutôt que d'en empiler une seconde : la branche n'est pas encore poussée, et une migration corrective rendrait le DDL illisible en revue.

```bash
# git rm et non une suppression du disque : le contenu reste dans l'historique,
# donc récupérable, ce qu'exige la règle de suppression du dépôt.
git rm -r apps/dashboard/server/database/migrations
corepack pnpm@10.11.0 db:generate
corepack pnpm@10.11.0 vitest run tests/database/schema-conforme-au-document.test.ts
```

Puis commiter la correction à part, sans amender le commit de la tâche 2.

- [ ] **Étape 7 : commiter**

```bash
git add apps/dashboard/tests/database/data-md.ts \
        apps/dashboard/tests/database/data-md.test.ts \
        apps/dashboard/tests/database/schema-conforme-au-document.test.ts
git commit -F - <<'EOF'
chore(db): rendre data.md vérifiable au lieu d'être seulement lu

Un document de référence et une base divergent en quelques jours, et
l'écart ne se découvre qu'à l'intégration. Ce test lit les cinq tableaux
du document et les compare au catalogue PostgreSQL : la prochaine
modification de schéma faite d'un seul côté échouera en CI.

Le parseur lève dès qu'il ne trouve pas cinq tables : un test de
conformité qui passe à vide vaut moins que pas de test.
EOF
```

---

## Tâche 4 : le rôle `etl` et ses droits par colonne

Le coeur de l'attendu EC04. La frontière entre l'ETL et les données personnelles devient un refus de la base au lieu d'une phrase dans un document.

**Fichiers :**
- Créer : `apps/dashboard/server/database/migrations/0001_role_etl.sql`
- Modifier : `apps/dashboard/server/database/migrations/meta/_journal.json` (par drizzle-kit)
- Créer : `apps/dashboard/tests/database/role-etl-moindre-privilege.test.ts`

**Interfaces :**
- Consomme : `creerBaseDeTest` de la tâche 1, le schéma de la tâche 2.
- Produit : un rôle PostgreSQL `etl`, créé sans `LOGIN` et sans mot de passe, avec `SELECT` et `INSERT` sur `sites` et `UPDATE` sur sept de ses colonnes. Le rôle est **global au cluster**, les privilèges sont **par base**.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `apps/dashboard/tests/database/role-etl-moindre-privilege.test.ts` :

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'

// Mot de passe de test, jamais un secret : le rôle vit dans un conteneur
// jetable qui n'est joignable que par cette suite.
const MOT_DE_PASSE = 'mot-de-passe-de-test'
const PRIVILEGE_INSUFFISANT = '42501'

describe('le rôle etl ne peut faire que ce que data.md lui accorde', () => {
  let base: BaseDeTest
  let etl: postgres.Sql

  beforeAll(async () => {
    base = await creerBaseDeTest()

    const [{ literal }] = await base.sql<{ literal: string }[]>`
      SELECT quote_literal(${MOT_DE_PASSE}) AS literal
    `
    await base.sql.unsafe(`ALTER ROLE etl WITH LOGIN PASSWORD ${literal}`)

    await base.sql`
      INSERT INTO sites (id, name, type, capacity_kw, status)
      VALUES ('SITE001', 'Bureau Paris La Défense', 'office', 200, 'active')
    `

    const url = new URL(base.url)
    url.username = 'etl'
    url.password = MOT_DE_PASSE
    etl = postgres(url.toString(), { max: 1 })
  })

  afterAll(async () => {
    await etl?.end()
    await base?.fermer()
  })

  describe('ce qui doit passer', () => {
    it('lit les sites', async () => {
      const lignes = await etl`SELECT id FROM sites`
      expect(lignes).toHaveLength(1)
    })

    it('insère un site', async () => {
      await etl`
        INSERT INTO sites (id, name, type, capacity_kw, status)
        VALUES ('SITE002', 'Usine Lyon', 'factory', 500, 'active')
      `
      const lignes = await etl`SELECT id FROM sites WHERE id = 'SITE002'`
      expect(lignes).toHaveLength(1)
    })

    it('met à jour les sept colonnes autorisées', async () => {
      await etl`
        UPDATE sites
           SET name = 'Bureau Paris',
               type = 'office',
               location = 'Paris, France',
               capacity_kw = 220,
               status = 'active',
               present_in_source = TRUE,
               updated_at = NOW()
         WHERE id = 'SITE001'
      `
      const [ligne] = await etl<{ capacity_kw: number }[]>`
        SELECT capacity_kw FROM sites WHERE id = 'SITE001'
      `
      expect(ligne.capacity_kw).toBe(220)
    })
  })

  describe('ce qui doit être refusé', () => {
    const refus = async (requete: () => Promise<unknown>) => {
      await expect(requete()).rejects.toMatchObject({ code: PRIVILEGE_INSUFFISANT })
    }

    it('ne lit pas les comptes', async () => {
      await refus(() => etl`SELECT id FROM users`)
    })

    it('ne lit pas les sessions', async () => {
      await refus(() => etl`SELECT id FROM sessions`)
    })

    it('ne lit pas les périmètres d accès', async () => {
      await refus(() => etl`SELECT user_id FROM user_sites`)
    })

    it('n écrase pas un seuil réglé à l écran', async () => {
      await refus(() => etl`UPDATE sites SET warning_threshold_kw = 100`)
    })

    it('ne supprime aucun site', async () => {
      await refus(() => etl`DELETE FROM sites`)
    })

    it('ne touche pas au référentiel des rôles', async () => {
      await refus(() => etl`INSERT INTO roles (name) VALUES ('PIRATE')`)
    })
  })
})
```

Le test attend le code SQLSTATE `42501`, pas « une erreur » : une faute de frappe dans un nom de table lèverait aussi, et le test passerait pour de mauvaises raisons.

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
corepack pnpm@10.11.0 vitest run tests/database/role-etl-moindre-privilege.test.ts
```

Attendu : ÉCHEC dans `beforeAll`, `role "etl" does not exist` (SQLSTATE `42704`).

- [ ] **Étape 3 : générer le fichier de migration vide**

```bash
corepack pnpm@10.11.0 exec drizzle-kit generate --custom --name=role_etl
```

Attendu : création de `server/database/migrations/0001_role_etl.sql`, vide, et une entrée de plus dans `meta/_journal.json`.

- [ ] **Étape 4 : écrire la migration**

Remplacer le contenu de `apps/dashboard/server/database/migrations/0001_role_etl.sql` :

```sql
-- Rôle PostgreSQL de l'ETL : la frontière entre l'ingestion et les données
-- personnelles est tenue par un droit de base, pas par une phrase dans un
-- document (docs/data.md, « Qui écrit dans sites, et jusqu'où »).
--
-- Créé sans LOGIN et sans mot de passe : un fichier commité ne porte pas de
-- secret, et un rôle qui ne peut pas se connecter est un défaut sûr. C'est
-- le script d'amorçage qui l'active, depuis ETL_DB_PASSWORD.
--
-- Le bloc DO n'est pas une précaution de style : les rôles PostgreSQL sont
-- globaux au cluster, alors que les privilèges sont par base. Cette migration
-- s'exécute donc plusieurs fois contre le même cluster, en test comme sur la
-- machine, et rencontrerait un rôle déjà créé.
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
-- warning_threshold_kw est absente, volontairement : un rechargement ne peut
-- pas effacer un seuil réglé à l'écran, même par erreur de code.
GRANT UPDATE (name, type, location, capacity_kw, status,
              present_in_source, updated_at) ON sites TO etl;
```

Aucun `REVOKE` n'est nécessaire : un rôle fraîchement créé n'a aucun privilège sur les tables, donc le refus sur `users`, `sessions` et `user_sites` est le comportement par défaut. Le test le vérifie quand même, parce que c'est le genre de propriété qu'une modification future casse sans le vouloir.

- [ ] **Étape 5 : lancer le test et vérifier qu'il passe**

```bash
corepack pnpm@10.11.0 vitest run tests/database/role-etl-moindre-privilege.test.ts
```

Attendu : SUCCÈS, 9 tests, dont 6 refus.

- [ ] **Étape 6 : lancer toute la suite**

```bash
corepack pnpm@10.11.0 test
```

Attendu : SUCCÈS. La migration `0001` s'applique désormais à toutes les bases de test, ce qui vérifie au passage que le bloc `DO` supporte bien d'être rejoué contre le même cluster.

- [ ] **Étape 7 : commiter**

```bash
git add apps/dashboard/server/database/migrations/ \
        apps/dashboard/tests/database/role-etl-moindre-privilege.test.ts
git commit -F - <<'EOF'
chore(db): borner l'ETL par un droit de base, pas par une phrase

L'écart du 15 septembre donne à l'ETL une écriture dans PostgreSQL. Il
n'était défendable qu'à une condition : que la frontière se démontre en
essayant et en se faisant refuser.

Le rôle est créé sans LOGIN, donc inerte tant que l'amorçage ne lui a pas
donné de mot de passe : un fichier commité ne porte pas de secret.

Les GRANT par colonne ne sont pas exprimables en Drizzle, d'où une
migration custom plutôt qu'un script à part : un seul journal rejouable,
et la revue porte sur du DDL.
EOF
```

---

## Tâche 5 : la rejouabilité des migrations

Le critère d'origine de #26, et la raison pour laquelle Drizzle a été préféré à un `init.sql`.

**Fichiers :**
- Créer : `apps/dashboard/tests/database/migration-rejouable.test.ts`

**Interfaces :**
- Consomme : `creerBaseDeTest({ migrer: false })` et `DOSSIER_MIGRATIONS` de la tâche 1, les migrations `0000` et `0001`.
- Produit : rien que d'autres tâches consomment.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `apps/dashboard/tests/database/migration-rejouable.test.ts` :

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { creerBaseDeTest, DOSSIER_MIGRATIONS, type BaseDeTest } from './base-de-test'

interface EntreeJournal {
  id: number
  hash: string
  created_at: string
}

describe('drizzle-kit migrate est rejouable', () => {
  let base: BaseDeTest
  let premierPassage: EntreeJournal[]

  const journal = () => base.sql<EntreeJournal[]>`
    SELECT id, hash, created_at
      FROM drizzle.__drizzle_migrations
     ORDER BY created_at, id
  `

  beforeAll(async () => {
    base = await creerBaseDeTest({ migrer: false })
    await migrate(drizzle(base.sql), { migrationsFolder: DOSSIER_MIGRATIONS })
    premierPassage = [...(await journal())]
  })

  afterAll(async () => {
    await base?.fermer()
  })

  it('a appliqué les deux migrations au premier passage', () => {
    expect(premierPassage).toHaveLength(2)
  })

  it('ne casse rien et n applique rien deux fois au second passage', async () => {
    await expect(
      migrate(drizzle(base.sql), { migrationsFolder: DOSSIER_MIGRATIONS })
    ).resolves.toBeUndefined()

    const secondPassage = [...(await journal())]
    expect(secondPassage).toEqual(premierPassage)
  })

  it('laisse les cinq tables et le rôle etl en place', async () => {
    const [{ tables }] = await base.sql<{ tables: number }[]>`
      SELECT count(*)::int AS tables
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `
    expect(tables).toBe(5)

    const [{ existe }] = await base.sql<{ existe: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') AS existe
    `
    expect(existe).toBe(true)
  })
})
```

- [ ] **Étape 2 : lancer le test**

```bash
corepack pnpm@10.11.0 vitest run tests/database/migration-rejouable.test.ts
```

Attendu : SUCCÈS, 3 tests. Ce test n'a pas de phase rouge propre : le mécanisme qu'il vérifie est livré par les tâches 2 et 4. Sa valeur est de **figer** la propriété avant qu'une migration future ne la casse. **S'il échoue au second passage**, la cause est presque toujours un ordre non idempotent dans `0001_role_etl.sql` : vérifier le garde `IF NOT EXISTS` du bloc `DO`.

- [ ] **Étape 3 : vérifier que le test détecte bien une régression**

Preuve que le test n'est pas décoratif. Retirer temporairement le garde du bloc `DO` de `0001_role_etl.sql`, en remplaçant tout le bloc par `CREATE ROLE etl NOLOGIN;`, puis :

```bash
corepack pnpm@10.11.0 vitest run tests/database/migration-rejouable.test.ts
```

Attendu : ÉCHEC, `role "etl" already exists` (SQLSTATE `42710`).

**Ce test doit détecter la régression à lui seul**, et c'est le point délicat. Le second `migrate()` sur la **même** base ne rejoue pas la migration `0001` : Drizzle lit son journal, la trouve appliquée, et passe. Le garde `IF NOT EXISTS` n'est donc jamais exercé par un second passage sur une base inchangée. Ce qui l'exerce, c'est une **seconde base** dans le même cluster, où le rôle `etl` existe déjà mais où le journal est vierge.

Le fichier crée donc une seconde base par `creerBaseDeTest({ migrer: false })` et la migre à son tour. Sans cela, le test passerait seul même avec le garde cassé, et ne rattraperait la régression que par accident, parce que d'autres fichiers de test tournent à côté.

**Restaurer ensuite le bloc `DO`** (`git checkout -- apps/dashboard/server/database/migrations/0001_role_etl.sql`) et relancer pour retrouver le succès.

- [ ] **Étape 4 : commiter**

```bash
git add apps/dashboard/tests/database/migration-rejouable.test.ts
git commit -F - <<'EOF'
chore(db): figer la rejouabilité, qui est le motif du choix de Drizzle

Un init.sql monté dans docker-entrypoint-initdb.d ne s'exécute que sur un
répertoire de données vide : c'est ce qui l'a fait écarter au profit d'un
journal de migrations. Une propriété choisie pour elle-même mérite un test,
sinon la première migration custom mal écrite la reprend en silence.
EOF
```

---

## Tâche 6 : l'amorçage idempotent

**Fichiers :**
- Créer : `apps/dashboard/server/database/seed.ts`
- Créer : `apps/dashboard/server/database/seed.cli.ts`
- Modifier : `apps/dashboard/package.json`
- Créer : `apps/dashboard/tests/database/amorcage-idempotent.test.ts`

**Interfaces :**
- Consomme : `creerBaseDeTest` de la tâche 1, les tables de la tâche 2, le rôle `etl` de la tâche 4.
- Produit : `amorcer(sql: Sql, options: OptionsAmorcage): Promise<ResultatAmorcage>`, avec `interface OptionsAmorcage { motDePasseDemonstration: string; motDePasseEtl: string }` et `interface ResultatAmorcage { rolesCrees: number; comptesCrees: number }`. Exporte aussi les constantes `ROLES` et `COMPTES_DE_DEMONSTRATION`.

- [ ] **Étape 1 : ajouter la dépendance de hachage**

```bash
corepack pnpm@10.11.0 add @node-rs/argon2@^2.2.1
```

En dépendance de production, pas de développement : #29 l'utilisera pour vérifier les mots de passe à la connexion.

- [ ] **Étape 2 : écrire le test qui échoue**

Créer `apps/dashboard/tests/database/amorcage-idempotent.test.ts` :

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'
import { amorcer, COMPTES_DE_DEMONSTRATION, ROLES } from '../../server/database/seed'

const OPTIONS = {
  motDePasseDemonstration: 'mot-de-passe-de-test',
  motDePasseEtl: 'mot-de-passe-etl-de-test'
}

describe('amorçage', () => {
  let base: BaseDeTest

  beforeAll(async () => {
    base = await creerBaseDeTest()
  })

  afterAll(async () => {
    await base?.fermer()
  })

  const compter = async (table: 'roles' | 'users') => {
    const [{ total }] = await base.sql<{ total: number }[]>`
      SELECT count(*)::int AS total FROM ${base.sql(table)}
    `
    return total
  }

  it('crée les trois rôles et les trois comptes au premier passage', async () => {
    const resultat = await amorcer(base.sql, OPTIONS)

    expect(resultat).toEqual({ rolesCrees: 3, comptesCrees: 3 })
    expect(await compter('roles')).toBe(ROLES.length)
    expect(await compter('users')).toBe(COMPTES_DE_DEMONSTRATION.length)
  })

  it('hache les mots de passe en Argon2id', async () => {
    const [ligne] = await base.sql<{ password_hash: string }[]>`
      SELECT password_hash FROM users WHERE email = ${COMPTES_DE_DEMONSTRATION[0].email}
    `
    expect(ligne.password_hash).toMatch(/^\$argon2id\$/)
    expect(ligne.password_hash).toContain('m=19456,t=2,p=1')
  })

  it('ne duplique rien au second passage', async () => {
    const resultat = await amorcer(base.sql, OPTIONS)

    expect(resultat).toEqual({ rolesCrees: 0, comptesCrees: 0 })
    expect(await compter('roles')).toBe(ROLES.length)
    expect(await compter('users')).toBe(COMPTES_DE_DEMONSTRATION.length)
  })

  it('n écrase pas un mot de passe changé depuis', async () => {
    const email = COMPTES_DE_DEMONSTRATION[0].email
    const empreinteChangee = '$argon2id$empreinte-posee-a-la-main'

    await base.sql`
      UPDATE users SET password_hash = ${empreinteChangee} WHERE email = ${email}
    `
    await amorcer(base.sql, OPTIONS)

    const [ligne] = await base.sql<{ password_hash: string }[]>`
      SELECT password_hash FROM users WHERE email = ${email}
    `
    expect(ligne.password_hash).toBe(empreinteChangee)
  })

  it('n amorce aucun site : le référentiel appartient à l ETL', async () => {
    const [{ total }] = await base.sql<{ total: number }[]>`
      SELECT count(*)::int AS total FROM sites
    `
    expect(total).toBe(0)
  })

  it('rend le rôle etl capable de se connecter', async () => {
    const [ligne] = await base.sql<{ rolcanlogin: boolean }[]>`
      SELECT rolcanlogin FROM pg_roles WHERE rolname = 'etl'
    `
    expect(ligne.rolcanlogin).toBe(true)
  })

  it('s arrête clairement si les migrations n ont pas été appliquées', async () => {
    const vierge = await creerBaseDeTest({ migrer: false })
    try {
      await expect(amorcer(vierge.sql, OPTIONS)).rejects.toThrow()
    } finally {
      await vierge.fermer()
    }
  })
})
```

- [ ] **Étape 3 : lancer le test et vérifier qu'il échoue**

```bash
corepack pnpm@10.11.0 vitest run tests/database/amorcage-idempotent.test.ts
```

Attendu : ÉCHEC, `Failed to resolve import "../../server/database/seed"`.

- [ ] **Étape 4 : écrire l'amorçage**

Créer `apps/dashboard/server/database/seed.ts` :

```ts
// Amorçage idempotent : trois rôles et un compte de démonstration par rôle.
//
// Idempotent veut dire deux choses, et la seconde est la moins évidente : un
// second passage ne crée pas de doublon, ET n'écrase pas un mot de passe
// changé depuis. C'est la clause ON CONFLICT DO NOTHING qui tient la seconde ;
// un DO UPDATE remettrait chaque compte à sa valeur d'usine à chaque passage.
//
// Aucun site n'est amorcé : le référentiel appartient à l'ETL (#21), et seuls
// les identifiants SITE001 à SITE007 sont connus ici. Une ligne inventée ne
// serait jamais corrigée, l'ETL n'insérant que les sites absents.
import { hash } from '@node-rs/argon2'
import type { Sql } from 'postgres'

// Paramètres de docs/data.md, repris de la fiche OWASP « Password Storage ».
export const PARAMETRES_ARGON2ID = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const

export const ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'] as const

export const COMPTES_DE_DEMONSTRATION = [
  { email: 'admin@enervision.local', role: 'ADMIN' },
  { email: 'operator@enervision.local', role: 'OPERATOR' },
  { email: 'viewer@enervision.local', role: 'VIEWER' }
] as const

export interface OptionsAmorcage {
  motDePasseDemonstration: string
  motDePasseEtl: string
}

export interface ResultatAmorcage {
  rolesCrees: number
  comptesCrees: number
}

export async function amorcer(
  sql: Sql,
  options: OptionsAmorcage
): Promise<ResultatAmorcage> {
  let rolesCrees = 0
  for (const role of ROLES) {
    const inseres = await sql`
      INSERT INTO roles (name) VALUES (${role})
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `
    rolesCrees += inseres.length
  }

  let comptesCrees = 0
  for (const compte of COMPTES_DE_DEMONSTRATION) {
    // Le hachage a lieu avant l'insertion, donc aussi quand le compte existe
    // déjà. Trois hachages Argon2id par passage, soit une fraction de seconde :
    // moins cher qu'une requête d'existence de plus, et sans course.
    const empreinte = await hash(options.motDePasseDemonstration, PARAMETRES_ARGON2ID)
    const inseres = await sql`
      INSERT INTO users (role_id, email, password_hash)
      SELECT r.id, ${compte.email}, ${empreinte}
        FROM roles r
       WHERE r.name = ${compte.role}
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `
    comptesCrees += inseres.length
  }

  await activerRoleEtl(sql, options.motDePasseEtl)

  return { rolesCrees, comptesCrees }
}

// La migration 0001 crée le rôle sans LOGIN ni mot de passe. C'est ici qu'il
// devient utilisable, et seulement ici, parce que le secret vient de
// l'environnement et ne doit apparaître dans aucun fichier commité.
async function activerRoleEtl(sql: Sql, motDePasse: string): Promise<void> {
  const [existe] = await sql<{ present: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') AS present
  `
  if (!existe.present) {
    throw new Error(
      "Le rôle PostgreSQL « etl » n'existe pas : appliquer les migrations avant d'amorcer."
    )
  }

  // PostgreSQL n'accepte pas de paramètre lié dans ALTER ROLE ... PASSWORD, et
  // un bloc DO n'en accepte pas davantage. L'échappement se fait donc côté
  // serveur, par quote_literal, avant d'assembler la commande.
  const [{ literal }] = await sql<{ literal: string }[]>`
    SELECT quote_literal(${motDePasse}) AS literal
  `
  await sql.unsafe(`ALTER ROLE etl WITH LOGIN PASSWORD ${literal}`)
}
```

- [ ] **Étape 5 : écrire le point d'entrée**

Créer `apps/dashboard/server/database/seed.cli.ts` :

```ts
// Seul endroit qui lit l'environnement et ouvre une connexion : `amorcer` reste
// une fonction pure de ce point de vue, donc appelable deux fois par un test.
import postgres from 'postgres'
import { amorcer } from './seed'

function requis(nom: string): string {
  const valeur = process.env[nom]
  if (!valeur) {
    // Pas de valeur par défaut, et surtout pas pour un mot de passe : un défaut
    // deviné finit par tourner en production sans que personne ne l'ait voulu.
    throw new Error(`${nom} n'est pas renseignée. Voir .env.example.`)
  }
  return valeur
}

const sql = postgres(requis('NUXT_DATABASE_URL'), { max: 1 })

try {
  const resultat = await amorcer(sql, {
    motDePasseDemonstration: requis('SEED_PASSWORD'),
    motDePasseEtl: requis('ETL_DB_PASSWORD')
  })
  console.info(
    `Amorçage terminé : ${resultat.rolesCrees} rôle(s) et ${resultat.comptesCrees} compte(s) créés.`
  )
} finally {
  await sql.end()
}
```

Ajouter dans les scripts de `apps/dashboard/package.json` :

```json
    "db:seed": "tsx --env-file-if-exists=../../.env server/database/seed.cli.ts",
```

`--env-file-if-exists` plutôt que `--env-file` : dans un conteneur, l'environnement est déjà posé et il n'y a pas de fichier `.env`.

- [ ] **Étape 6 : lancer le test et vérifier qu'il passe**

```bash
corepack pnpm@10.11.0 vitest run tests/database/amorcage-idempotent.test.ts
```

Attendu : SUCCÈS, 7 tests.

- [ ] **Étape 7 : lancer toute la suite et le lint**

```bash
corepack pnpm@10.11.0 test && corepack pnpm@10.11.0 lint
```

Attendu : SUCCÈS des deux.

- [ ] **Étape 8 : commiter**

```bash
git add apps/dashboard/server/database/seed.ts \
        apps/dashboard/server/database/seed.cli.ts \
        apps/dashboard/package.json apps/dashboard/pnpm-lock.yaml \
        apps/dashboard/tests/database/amorcage-idempotent.test.ts
git commit -F - <<'EOF'
chore(db): amorcer les rôles et les comptes sans jamais écraser

Un amorçage qui remet les mots de passe à leur valeur d'usine à chaque
passage n'est pas idempotent, il est destructeur : c'est ON CONFLICT DO
NOTHING et non DO UPDATE qui tient ce critère, et le test le prouve en
changeant une empreinte avant de relancer.

Aucun site n'est amorcé. Seuls les identifiants sont connus, les autres
colonnes sont NOT NULL, et l'ETL n'insère que les sites absents : une ligne
inventée ici ne serait jamais corrigée.

Le mot de passe du rôle etl vient de l'environnement, jamais d'un fichier.
EOF
```

---

## Tâche 7 : environnement, composition et intégration continue

Sans cette tâche, les tests des tâches 3 à 6 ne tournent jamais ailleurs que sur le poste qui les a écrits, et « vérifié, pas supposé » redevient déclaratif.

**Fichiers :**
- Modifier : `.env.example`
- Modifier : `docker-compose.yml`
- Modifier : `.github/workflows/ci.yml`

**Interfaces :**
- Consomme : le script `test` de la tâche 1, `db:seed` de la tâche 6, le rôle `etl` de la tâche 4.
- Produit : les variables `NUXT_DATABASE_URL`, `ETL_DB_PASSWORD` et `SEED_PASSWORD`.

- [ ] **Étape 1 : déclarer les variables**

Dans `.env.example`, juste après le bloc « Base de données » :

```bash
# URL de connexion de l'applicatif, lue par Nuxt (runtimeConfig.databaseUrl) et
# par drizzle-kit. Le préfixe NUXT_ est la convention Nuxt : il alimente seul la
# clé databaseUrl déclarée dans nuxt.config.ts.
NUXT_DATABASE_URL=postgresql://enervision:MOT_DE_PASSE@localhost:5432/enervision

# Rôle PostgreSQL de l'ETL, droits bornés à la table sites et à ses colonnes
# (docs/data.md). Créé sans LOGIN par la migration 0001, activé par l'amorçage.
# Valeur chiffrée avec SOPS, jamais en clair ici.
ETL_DB_PASSWORD=

# Mot de passe des trois comptes de démonstration créés par `pnpm db:seed`.
# Sans elle, l'amorçage s'arrête plutôt que de poser un mot de passe deviné.
SEED_PASSWORD=
```

- [ ] **Étape 2 : corriger le bloc ETL de la composition**

Dans `docker-compose.yml`, le service `etl` (encore commenté) donne au conteneur le compte **propriétaire** de la base, ce qui annulerait le cloisonnement mis en place par la tâche 4. Remplacer ces deux lignes commentées :

```yaml
  #     POSTGRES_USER: ${POSTGRES_USER:-enervision}
  #     POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}
```

par :

```yaml
  #     # Le rôle etl, et surtout pas le propriétaire de la base : SELECT et
  #     # INSERT sur la seule table sites, UPDATE sur sept de ses colonnes. Il
  #     # ne peut lire ni les comptes, ni les sessions, ni les périmètres, et
  #     # ne peut pas écrire warning_threshold_kw (docs/data.md).
  #     POSTGRES_USER: etl
  #     POSTGRES_PASSWORD: ${ETL_DB_PASSWORD:?renseigner ETL_DB_PASSWORD dans .env}
```

Ne rien changer d'autre dans ce bloc : les montages Parquet appartiennent à d'autres tickets.

- [ ] **Étape 3 : activer le job `dashboard` de la CI**

Dans `.github/workflows/ci.yml`, remplacer tout le corps `steps:` du job `dashboard` par :

```yaml
    steps:
      - uses: actions/checkout@v7
      # pnpm s'installe AVANT setup-node : c'est setup-node qui calcule la clé
      # du cache pnpm, et il lui faut le gestionnaire déjà présent. La version
      # est épinglée parce que la 9 ne lit pas ce lockfile, et que la dernière
      # refuse un pnpm-workspace.yaml sans champ packages.
      - uses: pnpm/action-setup@v4
        with: { version: 10.11.0 }
      # Node 22 et non 20 : Vitest 5 demande 20.19 au minimum, et `node-version: 20`
      # résout à la dernière 20.x du moment, ce qui est un pari inutile.
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: apps/dashboard/pnpm-lock.yaml
      - run: pnpm --dir apps/dashboard install --frozen-lockfile
      - run: pnpm --dir apps/dashboard lint
      # Les tests de base démarrent eux-mêmes un conteneur postgres:16-alpine
      # par Testcontainers : le démon Docker d'ubuntu-latest suffit, il n'y a
      # aucun service à déclarer ici.
      - run: pnpm --dir apps/dashboard test
      - run: pnpm --dir apps/dashboard build
```

- [ ] **Étape 4 : vérifier la composition**

```bash
docker compose config --quiet
```

Attendu : aucune sortie. En cas d'erreur sur une variable manquante, créer un `.env` local à partir de `.env.example` (il est ignoré par git) et relancer.

- [ ] **Étape 5 : vérifier que le build passe, puisque la CI l'exige désormais**

```bash
cd apps/dashboard && corepack pnpm@10.11.0 build
```

Attendu : SUCCÈS.

- [ ] **Étape 6 : commiter**

```bash
git add .env.example docker-compose.yml .github/workflows/ci.yml
git commit -F - <<'EOF'
chore(ci): faire tourner les tests de base ailleurs que sur un poste

Le job dashboard était entièrement commenté faute de lockfile. Il existe
maintenant, et sans ce job les tests de privilèges et de conformité au
document ne s'exécutent jamais à l'intégration : le « vérifié, pas
supposé » du ticket redeviendrait une intention.

La composition donnait au conteneur ETL le compte propriétaire de la base,
ce qui annulait le cloisonnement que cette branche met en place. Le service
est encore commenté, c'était le moment de le corriger.

pnpm épinglé en 10.11.0 : la 9 ne lit pas ce lockfile, et la dernière
refuse le pnpm-workspace.yaml du dépôt.
EOF
```

---

## Tâche 8 : remettre les documents d'accord avec le code

Une PR qui contredit `data.md` met le document à jour dans la même PR. Trois écarts sont connus.

**Fichiers :**
- Modifier : `docs/data.md`
- Modifier : `apps/dashboard/README.md`
- Modifier : `docs/README.md`

**Interfaces :**
- Consomme : tout ce qui précède.
- Produit : rien.

- [ ] **Étape 1 : corriger le chemin du SQL généré dans `docs/data.md`**

Section « Création du schéma ». Remplacer :

```markdown
- **Le SQL généré est commité** (`drizzle/0000_*.sql`), pour que le schéma se lise sans connaître l'ORM et qu'une revue porte sur du DDL.
```

par :

```markdown
- **Le SQL généré est commité** (`apps/dashboard/server/database/migrations/`), pour que le schéma se lise sans connaître l'ORM et qu'une revue porte sur du DDL. Le chemin est celui de `drizzle.config.ts` ; une version antérieure de ce document annonçait `drizzle/0000_*.sql`, qui n'a jamais existé.
```

- [ ] **Étape 2 : corriger le paragraphe d'amorçage dans `docs/data.md`**

Même section. Remplacer :

```markdown
**Amorçage.** Un script idempotent, repris de la proposition de l'applicatif : les trois rôles, les sept sites, et trois comptes de démonstration, un par rôle. Idempotent veut dire qu'un second passage ne crée pas de doublon et n'écrase pas un mot de passe changé depuis.
```

par :

```markdown
**Amorçage.** Un script idempotent, `pnpm db:seed` : les trois rôles et trois comptes de démonstration, un par rôle. Idempotent veut dire qu'un second passage ne crée pas de doublon et n'écrase pas un mot de passe changé depuis, ce que tient la clause `ON CONFLICT DO NOTHING`.

**Il n'amorce aucun site**, alors que la version du 15 septembre l'annonçait. Seuls les identifiants `SITE001` à `SITE007` sont connus du dépôt : `name`, `type`, `capacity_kw` et `status` sont `NOT NULL` et viennent de l'API Mock. Et l'ETL n'insère que les sites **absents**, sans jamais corriger une ligne existante, donc une valeur inventée à l'amorçage resterait en base pour de bon. Une démonstration complète demande donc l'amorçage **et** un passage de l'ETL.

**Le rôle `etl` est créé par la migration `0001_role_etl.sql`, sans `LOGIN` ni mot de passe.** Un fichier commité ne porte pas de secret. C'est l'amorçage qui l'active, depuis `ETL_DB_PASSWORD`. Conséquence à connaître : la migration demande `CREATEROLE` ou la superutilisation, ce dont dispose le compte `POSTGRES_USER` de la composition, mais pas forcément un compte de base managée.
```

- [ ] **Étape 3 : corriger `apps/dashboard/README.md`**

Le même chemin `drizzle/0000_*.sql` y figure, et la phrase « Le script d'amorçage idempotent (trois rôles, sept sites, un compte de démonstration par rôle) est repris tel quel de la proposition de contrats d'interfaces. » Remplacer cette phrase par :

```markdown
Le script d'amorçage idempotent crée les **trois rôles** et **un compte de démonstration par rôle**. Il n'amorce **aucun site** : le référentiel appartient à l'ETL, et les attributs des sept sites ne sont pas connus du dépôt. Voir [`docs/data.md`](../../docs/data.md).
```

Et corriger le chemin du SQL généré comme à l'étape 1. Puis ajouter une section, juste après « Création du schéma : tranché » :

```markdown
### Commandes

| Commande | Effet |
|---|---|
| `pnpm db:generate` | Génère une migration depuis `server/database/schema.ts`. À commiter |
| `pnpm db:migrate` | Applique les migrations en attente. Rejouable |
| `pnpm db:seed` | Trois rôles, trois comptes de démonstration, et active le rôle `etl` |
| `pnpm test` | Lint des types et tests. **Docker doit tourner** |
| `pnpm test:watch` | Les mêmes, en mode observateur |

Les tests démarrent eux-mêmes un conteneur `postgres:16-alpine` jetable, par
Testcontainers : il n'y a ni base de test à créer à la main, ni composition à
lancer au préalable. La première exécution tire l'image, les suivantes non.

Les variables attendues sont dans [`.env.example`](../../.env.example) :
`NUXT_DATABASE_URL`, `ETL_DB_PASSWORD` et `SEED_PASSWORD`.
```

- [ ] **Étape 4 : signaler le répertoire des conceptions dans `docs/README.md`**

Ajouter une ligne au tableau, après `runbook.md` :

```markdown
| `superpowers/specs/` | Conceptions validées avant implémentation, une par sujet, datées | transverse |
```

- [ ] **Étape 5 : relire les écarts restants**

```bash
grep -rn "drizzle/0000\|sept sites" docs/ apps/dashboard/README.md
```

Attendu : aucune correspondance, sauf dans `docs/superpowers/specs/` et `docs/superpowers/plans/`, qui décrivent la décision et n'ont pas à être réécrits.

- [ ] **Étape 6 : lancer une dernière fois toute la suite**

```bash
cd apps/dashboard && corepack pnpm@10.11.0 test && corepack pnpm@10.11.0 lint
```

Attendu : SUCCÈS. Le test de conformité relit `docs/data.md` : s'il échoue après ces modifications, c'est qu'un tableau de colonnes a été touché par erreur.

- [ ] **Étape 7 : commiter**

```bash
git add docs/data.md docs/README.md apps/dashboard/README.md
git commit -F - <<'EOF'
docs(data): remettre le document d'accord avec la base qu'il décrit

Trois écarts : un chemin de migrations qui n'a jamais existé, un amorçage
annoncé avec sept sites qu'il ne crée pas, et un rôle etl dont le document
ne disait pas qu'il naît sans mot de passe.

Le test de conformité rend désormais le premier tableau vérifiable ; ces
phrases-là ne le sont pas, d'où la correction à la main, dans la PR qui
crée l'écart plutôt que dans celle qui le découvrira.
EOF
```

---

## Vérification finale, avant la pull request

- [ ] `cd apps/dashboard && corepack pnpm@10.11.0 install --frozen-lockfile` passe.
- [ ] `corepack pnpm@10.11.0 lint` passe.
- [ ] `corepack pnpm@10.11.0 test` passe, avec le compte de tests attendu : 1 (existant) + 2 (socle) + 4 (schéma appliqué) + 6 (parseur) + 3 (rejouabilité) + 9 (privilèges) + 7 (amorçage) + les tests générés par le test de conformité.
- [ ] `corepack pnpm@10.11.0 build` passe.
- [ ] `docker compose config --quiet` ne sort rien.
- [ ] `git log --format='%an %s' origin/main..HEAD` : aucun trailer d'outil, sujets en français accentué, tous préfixés `chore` ou `docs`.
- [ ] `git grep -nE '(^|[^-])--([^-]|$)' -- docs/ ':!docs/superpowers'` ne remonte que des séparateurs de tableaux Markdown.
- [ ] Aucun secret : `git diff origin/main..HEAD | grep -iE 'password.*=.*[a-z0-9]{8}'` ne remonte que les mots de passe **de test** des fichiers sous `tests/`.
- [ ] La description de la PR signale les trois fichiers à propriétaire tiers : `.github/workflows/ci.yml` et `docker-compose.yml` (`@HugoMrnth`), `apps/dashboard/**` (`@antoinecoulon`).
