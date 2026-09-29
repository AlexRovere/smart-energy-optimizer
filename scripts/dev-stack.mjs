#!/usr/bin/env node
// Pile de développement : une commande, sans secret ni appel vers l'extérieur.
//
//   node scripts/dev-stack.mjs up                     tout, dashboard compris
//   node scripts/dev-stack.mjs up --without-dashboard tout sauf le dashboard
//   node scripts/dev-stack.mjs down                   arrête, garde les données
//   node scripts/dev-stack.mjs reset                  arrête et repart de zéro
//   node scripts/dev-stack.mjs exec <commande...>     lance une commande avec
//                                                     les valeurs de dev (pnpm dev)
//
// Les valeurs viennent de dev.env, versionné, puis de .env.local s'il existe,
// qui l'emporte. Le script existe surtout pour ce « s'il existe » : Compose
// échoue sur un `--env-file` absent.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_ENV = resolve(ROOT, 'dev.env')
const LOCAL_ENV = resolve(ROOT, '.env.local')
const PARQUET_DIR = resolve(ROOT, 'data', 'parquet-dev')

// Tout sauf le dashboard, pour `pnpm dev` : les dépendances suivent d'elles-mêmes.
const BACKEND_SERVICES = ['mock-api', 'postgres', 'migrate', 'seed', 'parquet-init', 'etl', 'ml', 'ml-train']

function envFiles() {
  return existsSync(LOCAL_ENV) ? [DEV_ENV, LOCAL_ENV] : [DEV_ENV]
}

function compose(args) {
  const files = envFiles().flatMap(file => ['--env-file', file])
  const result = spawnSync(
    'docker',
    [
      'compose',
      ...files,
      '-f', resolve(ROOT, 'docker-compose.yml'),
      '-f', resolve(ROOT, 'docker-compose.dev.yml'),
      ...args
    ],
    { cwd: ROOT, stdio: 'inherit' }
  )
  if (result.error) throw result.error
  return result.status ?? 1
}

function up(withoutDashboard) {
  let services = []
  if (withoutDashboard) {
    // Nuxt sur le poste lit l'historique : il doit être dans un répertoire du
    // poste, pas dans le volume nommé. L'environnement du shell l'emporte sur
    // dev.env dans Compose. Créé ici par l'utilisateur du poste : laissé à
    // Docker, il appartiendrait à root sous Linux.
    process.env.PARQUET_DIR_HOST = './data/parquet-dev'
    mkdirSync(PARQUET_DIR, { recursive: true })
    services = BACKEND_SERVICES
    // Un dashboard laissé par un `up` complet garderait le port 3000, celui
    // de `pnpm dev`. `up` avec une liste de services n'arrête pas les autres.
    const status = compose(['rm', '--stop', '--force', 'dashboard'])
    if (status !== 0) return status
  }
  const status = compose(['up', '--detach', '--build', '--wait', ...services])
  if (status === 0) {
    console.info(
      withoutDashboard
        ? '\nPile prête sans le dashboard : `pnpm dev` depuis apps/dashboard.'
        : '\nPile prête : http://localhost:3000, admin@enervision.local et le SEED_PASSWORD de dev.env.'
    )
  }
  return status
}

function reset() {
  const status = compose(['down', '--volumes', '--remove-orphans'])
  // Mis de côté plutôt que supprimé : rien ne s'efface sans passer par la main
  // de quelqu'un. L'historique se régénère au prochain `up`.
  if (existsSync(PARQUET_DIR)) {
    const aside = `${PARQUET_DIR}.${new Date().toISOString().replace(/[:.]/g, '-')}`
    renameSync(PARQUET_DIR, aside)
    console.info(`Historique fictif mis de côté dans ${aside}, à supprimer quand il ne sert plus.`)
  }
  return status
}

function exec(command) {
  if (command.length === 0) {
    console.error('exec : commande manquante.')
    return 1
  }
  // Une variable déjà posée n'est jamais écrasée : .env.local d'abord, pour
  // qu'il l'emporte sur dev.env, et l'environnement du shell avant les deux.
  for (const file of envFiles().reverse()) process.loadEnvFile(file)
  const result = spawnSync(command.join(' '), { stdio: 'inherit', shell: true })
  if (result.error) throw result.error
  return result.status ?? 1
}

const [action, ...rest] = process.argv.slice(2)
const actions = {
  up: () => up(rest.includes('--without-dashboard')),
  down: () => compose(['down']),
  reset,
  exec: () => exec(rest)
}

if (!actions[action]) {
  console.error('Usage : node scripts/dev-stack.mjs up [--without-dashboard] | down | reset | exec <commande...>')
  process.exit(1)
}
process.exit(actions[action]())
