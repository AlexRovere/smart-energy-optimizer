import { watch } from 'vue'
import type { Ref } from 'vue'

export interface FetchErrorContext {
  url: string | (() => string)
  route: () => string
}

export function watchFetchError(
  error: Ref<Error | null | undefined>,
  context: FetchErrorContext
) {
  watch(error, (err) => {
    if (!err) return
    console.error('[EnerVision] Erreur réseau ou serveur', {
      timestamp: new Date().toISOString(),
      route: context.route(),
      url: typeof context.url === 'function' ? context.url() : context.url,
      message: err.message,
    })
  })
}
