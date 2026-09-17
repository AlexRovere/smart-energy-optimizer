// Configuration de drizzle-kit pour la boucle locale : elle ne diffère de
// `drizzle.config.ts` que par le fichier chargé, `.env.dev` au lieu de `.env`.
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

const ENV_DEV = resolve(process.cwd(), '../../.env.dev')
if (existsSync(ENV_DEV)) {
  loadEnvFile(ENV_DEV)
}

if (!process.env.NUXT_DATABASE_URL) {
  throw new Error(
    "NUXT_DATABASE_URL n'est pas renseignée et .env.dev est introuvable. Ce fichier est versionné : un clone complet le porte."
  )
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL
  }
})
