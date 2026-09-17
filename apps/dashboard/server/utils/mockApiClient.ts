import { $fetch } from 'ofetch'
import { createError } from 'h3'

const RETRY_MAX = 3
const TIMEOUT_MS = 5_000

// L'API Mock porte son authentification dans l'URL (`https://user:pass@hote`).
// Le `fetch` de Node, sur lequel repose ofetch, refuse ce format : « Request
// cannot be constructed from a URL that includes credentials ». Les trois
// tentatives échouaient donc toutes, et la route rendait un 503 qui présentait
// une erreur de configuration comme une source absente.
//
// Le mot de passe est conservé pour être retiré des messages d'erreur : `fetch`
// y recopie l'URL entière, et une de ces erreurs a déjà fini affichée dans un
// terminal.
interface Source {
  base: string
  entetes: Record<string, string>
  secrets: string[]
}

function separerIdentifiants(baseUrl: string): Source {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    return { base: baseUrl, entetes: {}, secrets: [] }
  }

  if (!url.username && !url.password) {
    return { base: baseUrl, entetes: {}, secrets: [] }
  }

  const utilisateur = decodeURIComponent(url.username)
  const motDePasse = decodeURIComponent(url.password)
  // La forme encodée autant que la forme lisible : c'est la première qui
  // apparaît dans l'URL, donc dans les messages d'erreur.
  const secrets = [...new Set([url.password, motDePasse].filter(Boolean))]

  url.username = ''
  url.password = ''

  return {
    base: url.toString(),
    entetes: {
      Authorization: `Basic ${Buffer.from(`${utilisateur}:${motDePasse}`).toString('base64')}`,
    },
    secrets,
  }
}

function sansSecret(erreur: unknown, secrets: string[]): unknown {
  if (secrets.length === 0 || !(erreur instanceof Error)) return erreur

  const message = secrets.reduce((texte, secret) => texte.split(secret).join('***'), erreur.message)
  if (message === erreur.message) return erreur

  const masquee = new Error(message)
  masquee.name = erreur.name
  return masquee
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchMockApi<T>(
  path: string,
  baseUrl: string = useRuntimeConfig().mockApiUrl as string,
  { sleepFn = sleep }: { sleepFn?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const source = separerIdentifiants(baseUrl)
  let lastError: unknown

  for (let attempt = 0; attempt < RETRY_MAX; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const result = await $fetch<T>(path, {
        baseURL: source.base,
        headers: source.entetes,
        signal: controller.signal,
      })
      clearTimeout(timer)
      return result
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      if (attempt < RETRY_MAX - 1) {
        await sleepFn(1_000 * Math.pow(2, attempt))
      }
    }
  }

  throw createError({
    status: 503,
    statusText: 'Source de données indisponible',
    cause: sansSecret(lastError, source.secrets),
  })
}
