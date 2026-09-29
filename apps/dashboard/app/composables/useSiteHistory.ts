import { useFetch, useRoute } from 'nuxt/app'
import { computed } from 'vue'
import type { Ref } from 'vue'
import type { Reading, SiteId } from '../types/api'
import { watchFetchError } from '../utils/fetchError'

function timeRange(timeWindow: '24h' | '7j') {
  // Arrondi à la minute pour stabiliser la clé entre SSR et hydratation client
  const to = new Date(Math.floor(Date.now() / 60000) * 60000)
  const from = new Date(to)
  if (timeWindow === '24h') from.setHours(from.getHours() - 24)
  else from.setDate(from.getDate() - 7)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function useSiteHistory(siteId: Ref<SiteId>, timeWindow: Ref<'24h' | '7j'>) {
  const { data, pending, error } = useFetch<Reading[]>(
    () => {
      const { from, to } = timeRange(timeWindow.value)
      return `/api/sites/${siteId.value}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    },
    { watch: [siteId, timeWindow] }
  )
  const route = useRoute()
  watchFetchError(error, {
    url: () => `/api/sites/${siteId.value}/history`,
    route: () => route.path,
  })
  const readings = computed(() => data.value ?? [])
  return { readings, pending, error }
}
