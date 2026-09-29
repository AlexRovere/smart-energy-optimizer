// Seul endroit qui lit l'environnement et ouvre une connexion : `seedDatabase` reste
// une fonction pure de ce point de vue, donc appelable deux fois par un test.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import postgres from 'postgres'
import { seedDatabase } from './seed'
import { databaseUrlFromEnv } from './databaseUrl'

// Même règle que `drizzle.config.ts`, et au même endroit que lui plutôt que
// dans un drapeau de `package.json` : une variable déjà présente dans
// l'environnement n'est jamais écrasée par un fichier. Sans cette condition, un
// `NUXT_DATABASE_URL` périmé traînant dans un `.env` l'emporterait sur les
// morceaux que `sops exec-env` vient de fournir, et l'amorçage viserait la
// mauvaise base sans rien dire.
const ROOT_ENV = resolve(process.cwd(), '../../.env')
if (!process.env.NUXT_DATABASE_URL && !process.env.POSTGRES_PASSWORD && existsSync(ROOT_ENV)) {
  loadEnvFile(ROOT_ENV)
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    // Pas de valeur par défaut, et surtout pas pour un mot de passe : un défaut
    // deviné finit par tourner en production sans que personne ne l'ait voulu.
    throw new Error(`${name} n'est pas renseignée. Voir .env.example.`)
  }
  return value
}

// Les morceaux, ou la surcharge NUXT_DATABASE_URL si elle est posée : même
// assemblage que l'applicatif, pour que l'amorçage vise la base que le
// déploiement fait tourner, sans qu'aucun `.env` n'ait à exister (#158).
const sql = postgres(databaseUrlFromEnv(), { max: 1 })

try {
  const result = await seedDatabase(sql, {
    demoPassword: requireEnv('SEED_PASSWORD'),
    etlPassword: requireEnv('ETL_DB_PASSWORD')
  })
  console.info(
    `Amorçage terminé : ${result.createdRoles} rôle(s), ${result.createdAccounts} compte(s), ${result.createdSites} site(s) et ${result.createdAccess} accès créés.`
  )
} finally {
  await sql.end()
}
