import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { inject } from 'vitest'

export const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../server/database/migrations'
)

export interface TestDatabase {
  url: string
  sql: postgres.Sql
  close: () => Promise<void>
}

// Une requête `postgres` rend toujours un tableau, et `noUncheckedIndexedAccess`
// a raison de le rappeler : rien ne promet au compilateur qu'il contient une
// ligne. Plutôt que d'affirmer le contraire au coup par coup, les tests passent
// tous par ici. Une requête muette échoue alors en nommant ce qu'on attendait,
// au lieu de se traduire en « cannot read properties of undefined » à dérouler.
export function expectedRow<T>(rows: readonly T[], expected: string): T {
  const [row] = rows
  if (row === undefined) {
    throw new Error(`Aucune ligne rendue pour ${expected}.`)
  }
  return row
}

// À poser en `describe.skipIf(!databaseAvailable())` en tête des fichiers qui ont
// besoin d'une base. L'amorce globale rend une URL vide quand aucun runtime de
// conteneurs n'a répondu, ce qui n'arrive que sur un poste : en intégration
// continue, elle échoue avant d'en arriver là.
export function databaseAvailable(): boolean {
  return inject('adminUrl') !== ''
}

export async function createTestDatabase(
  options: { migrate?: boolean } = {}
): Promise<TestDatabase> {
  const adminUrl = inject('adminUrl')
  if (adminUrl === '') {
    throw new Error(
      "Aucune base de test disponible : ce fichier aurait dû s'ignorer par "
      + 'describe.skipIf(!databaseAvailable()).'
    )
  }
  // Un nom de base ne peut pas porter de tiret sans être cité : on les retire.
  const name = `test_${randomUUID().replaceAll('-', '')}`

  // CREATE DATABASE refuse de s'exécuter dans une transaction, d'où `unsafe`.
  const admin = postgres(adminUrl, { max: 1 })
  await admin.unsafe(`CREATE DATABASE ${name}`)
  await admin.end()

  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  const sql = postgres(url.toString(), { max: 1 })

  if (options.migrate !== false) {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_DIR })
  }

  return { url: url.toString(), sql, close: () => sql.end() }
}
