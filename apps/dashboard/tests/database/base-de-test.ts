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

// Une requête `postgres` rend toujours un tableau, et `noUncheckedIndexedAccess`
// a raison de le rappeler : rien ne promet au compilateur qu'il contient une
// ligne. Plutôt que d'affirmer le contraire au coup par coup, les tests passent
// tous par ici. Une requête muette échoue alors en nommant ce qu'on attendait,
// au lieu de se traduire en « cannot read properties of undefined » à dérouler.
export function ligneAttendue<T>(lignes: readonly T[], attendu: string): T {
  const [ligne] = lignes
  if (ligne === undefined) {
    throw new Error(`Aucune ligne rendue pour ${attendu}.`)
  }
  return ligne
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
