import { useFetch, useRoute } from 'nuxt/app'
import { computed } from 'vue'
import type { Ref } from 'vue'
import type { Reading, SiteId } from '../types/api'
import { observerErreurFetch } from '../utils/erreurFetch'

function plage(fenêtre: '24h' | '7j') {
  // Arrondi à la minute pour stabiliser la clé entre SSR et hydratation client
  const to = new Date(Math.floor(Date.now() / 60000) * 60000)
  const from = new Date(to)
  if (fenêtre === '24h') from.setHours(from.getHours() - 24)
  else from.setDate(from.getDate() - 7)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function useSiteHistory(siteId: Ref<SiteId>, fenêtre: Ref<'24h' | '7j'>) {
  const { data, pending, error } = useFetch<Reading[]>(
    () => {
      const { from, to } = plage(fenêtre.value)
      return `/api/sites/${siteId.value}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    },
    { watch: [siteId, fenêtre] }
  )
  const route = useRoute()
  observerErreurFetch(error, {
    url: () => `/api/sites/${siteId.value}/history`,
    route: () => route.path,
  })
  const readings = computed(() => data.value ?? [])
  return { readings, pending, error }
}
