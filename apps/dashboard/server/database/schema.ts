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
