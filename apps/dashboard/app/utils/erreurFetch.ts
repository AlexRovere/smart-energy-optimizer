import { watch } from 'vue'
import type { Ref } from 'vue'

export interface ContexteErreurFetch {
  url: string | (() => string)
  route: () => string
}

export function observerErreurFetch(
  error: Ref<Error | null | undefined>,
  contexte: ContexteErreurFetch
) {
  watch(error, (err) => {
    if (!err) return
    console.error('[EnerVision] Erreur réseau ou serveur', {
      timestamp: new Date().toISOString(),
      route: contexte.route(),
      url: typeof contexte.url === 'function' ? contexte.url() : contexte.url,
      message: err.message,
    })
  })
}
