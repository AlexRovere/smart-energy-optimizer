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
