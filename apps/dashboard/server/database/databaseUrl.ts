// L'URL de connexion s'assemble ici, et nulle part ailleurs. Elle mélange une
// seule valeur secrète, le mot de passe, et quatre réglages qui changent selon
// d'où l'on appelle : `postgres:5432` depuis le réseau de la composition,
// `localhost` depuis la machine ou un poste. La stocker toute faite obligerait
// à figer un contexte, et à garder deux copies du mot de passe (#158).
//
// L'encodage n'est pas une précaution de style : un `/` dans le mot de passe
// termine l'autorité de l'URL, et Node répond `Invalid URL` sans désigner ni la
// base ni le mot de passe.

export interface DatabaseSettings {
  /** Surcharge explicite, rendue telle quelle. Les tests la reçoivent de Testcontainers. */
  url?: string
  host?: string
  port?: string
  database?: string
  user?: string
  password?: string
}

const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = '5432'

// Même doctrine que `seed.cli.ts` : nommer la variable absente plutôt que de
// laisser le pilote se plaindre d'une chaîne incompréhensible.
function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} n'est pas renseignée. Voir .env.example.`)
  }
  return value
}

export function buildDatabaseUrl(settings: DatabaseSettings): string {
  if (settings.url) return settings.url

  const user = encodeURIComponent(required(settings.user, 'POSTGRES_USER'))
  const password = encodeURIComponent(required(settings.password, 'POSTGRES_PASSWORD'))
  const database = required(settings.database, 'POSTGRES_DB')
  const host = settings.host || DEFAULT_HOST
  const port = settings.port || DEFAULT_PORT

  return `postgresql://${user}:${password}@${host}:${port}/${database}`
}

/** Les mêmes morceaux, lus dans l'environnement du processus. */
export function databaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return buildDatabaseUrl({
    url: env.NUXT_DATABASE_URL,
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
  })
}
