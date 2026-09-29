// Configuration de drizzle-kit pour la pile de dev : elle ne diffère de
// `drizzle.config.ts` que par les fichiers chargés, `.env.local` puis `dev.env`
// au lieu de `.env`. Le premier l'emporte, `loadEnvFile` n'écrasant jamais une
// variable déjà posée.
//
// Un second fichier plutôt qu'une condition dans le premier : `--config` est le
// seul endroit où `drizzle-kit migrate` peut dire quelle base il vise. Et un
// `export ... from './drizzle.config'` chargerait `.env` d'abord, les imports
// étant évalués avant le corps du module.
//
// Le chemin du schéma et celui des migrations sont donc tenus d'accord à la
// main avec `drizzle.config.ts`. L'écart échoue bruyamment.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'
import { databaseUrlFromEnv } from './server/database/databaseUrl'

const ENV_LOCAL = resolve(process.cwd(), '../../.env.local')
const ENV_DEV = resolve(process.cwd(), '../../dev.env')
if (existsSync(ENV_LOCAL)) {
  loadEnvFile(ENV_LOCAL)
}
if (existsSync(ENV_DEV)) {
  loadEnvFile(ENV_DEV)
}
else if (!process.env.NUXT_DATABASE_URL) {
  throw new Error(
    'dev.env est introuvable. Ce fichier est versionné : un clone complet le porte.'
  )
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: databaseUrlFromEnv()
  }
})
