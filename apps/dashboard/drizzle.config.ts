// drizzle-kit ne charge que le `.env` du répertoire courant, c'est-à-dire
// `apps/dashboard/`, alors que le dépôt n'a qu'un seul fichier d'environnement
// et qu'il est à la racine du monorepo : celui que le README envoie remplir, et
// celui que `db:seed` charge lui aussi. Sans la lecture ci-dessous,
// `pnpm db:migrate` ne trouvait pas de quoi se connecter.
//
// Charger la racine ici plutôt que d'habiller `db:migrate` d'un `tsx` : le
// besoin vient de ce fichier, qui est le seul à lire la variable, et la
// mécanique reste visible pour qui lit la configuration. Un script enveloppé
// aurait déplacé la surprise dans package.json sans l'expliquer.
//
// Le chemin part du répertoire courant, qui est celui du paquet : c'est ce que
// pnpm garantit pour un script, y compris appelé avec `--dir`.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'
import { databaseUrlFromEnv } from './server/database/databaseUrl'

// Une variable déjà présente dans l'environnement n'est jamais écrasée par un
// fichier : c'est ce qui laisse `sops exec-env` décider au déploiement, en
// fournissant les morceaux sans qu'aucun `.env` n'existe sur la machine.
const ENV_RACINE = resolve(process.cwd(), '../../.env')
if (!process.env.NUXT_DATABASE_URL && !process.env.POSTGRES_PASSWORD && existsSync(ENV_RACINE)) {
  loadEnvFile(ENV_RACINE)
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    // Assemble à partir des morceaux, ou rend la surcharge si elle existe.
    // Échoue en nommant la variable absente plutôt qu'en passant `undefined`.
    url: databaseUrlFromEnv()
  }
})