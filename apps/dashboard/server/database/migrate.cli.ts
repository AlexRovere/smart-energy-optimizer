// Applique les migrations Drizzle via l'API programmatique.
// Contourne un comportement de drizzle-kit CLI sur Windows : la commande
// retourne exit 1 lorsqu'aucune migration n'est en attente, ce qui rompt
// la chaîne && dans les scripts npm.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { databaseUrlFromEnv } from './databaseUrl'

const ENV_DEV = resolve(process.cwd(), '../../.env.dev')
if (!process.env.NUXT_DATABASE_URL && existsSync(ENV_DEV)) {
  loadEnvFile(ENV_DEV)
}

const sql = postgres(databaseUrlFromEnv(), { max: 1 })
const db = drizzle(sql)

try {
  await migrate(db, { migrationsFolder: './server/database/migrations' })
  console.info('Migrations appliquées.')
} finally {
  await sql.end()
}
