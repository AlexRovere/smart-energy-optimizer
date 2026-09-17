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
interface MockApiTarget {
  baseUrl: string
  headers: Record<string, string>
  secrets: string[]
}

function extractCredentials(baseUrl: string): MockApiTarget {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    return { baseUrl, headers: {}, secrets: [] }
  }

  if (!url.username && !url.password) {
    return { baseUrl, headers: {}, secrets: [] }
  }

  const username = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  // La forme encodée autant que la forme lisible : c'est la première qui
  // apparaît dans l'URL, donc dans les messages d'erreur.
  const secrets = [...new Set([url.password, password].filter(Boolean))]

  url.username = ''
  url.password = ''

  return {
    baseUrl: url.toString(),
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    },
    secrets,
  }
}

function redactSecrets(error: unknown, secrets: string[]): unknown {
  if (secrets.length === 0 || !(error instanceof Error)) return error

  const message = secrets.reduce((text, secret) => text.split(secret).join('***'), error.message)
  if (message === error.message) return error

  const redacted = new Error(message)
  redacted.name = error.name
  return redacted
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchMockApi<T>(
  path: string,
  baseUrl: string = useRuntimeConfig().mockApiUrl as string,
  { sleepFn = sleep }: { sleepFn?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const target = extractCredentials(baseUrl)
  let lastError: unknown

  for (let attempt = 0; attempt < RETRY_MAX; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const result = await $fetch<T>(path, {
        baseURL: target.baseUrl,
        headers: target.headers,
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
    cause: redactSecrets(lastError, target.secrets),
  })
}
