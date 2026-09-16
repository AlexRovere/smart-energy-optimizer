import { $fetch } from 'ofetch'
import { HTTPError } from 'h3'

const RETRY_MAX = 3
const TIMEOUT_MS = 5_000

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchMockApi<T>(
  path: string,
  baseUrl: string,
  { sleepFn = sleep }: { sleepFn?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < RETRY_MAX; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const result = await $fetch<T>(path, { baseURL: baseUrl, signal: controller.signal })
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

  throw new HTTPError('Source de données indisponible', { status: 503, cause: lastError })
}
