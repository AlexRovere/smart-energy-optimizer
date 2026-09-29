import { useFetch, useRoute } from 'nuxt/app'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { Reading, SiteId } from '../types/api'
import type { ChartWindow } from '../utils/charts'
import type { HistoryRange } from '../utils/historyRange'
import { watchFetchError } from '../utils/fetchError'

function timeRange(timeWindow: '24h' | '7j') {
  // Arrondi à la minute pour stabiliser la clé entre SSR et hydratation client
  const to = new Date(Math.floor(Date.now() / 60000) * 60000)
  const from = new Date(to)
  if (timeWindow === '24h') from.setHours(from.getHours() - 24)
  else from.setDate(from.getDate() - 7)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function useSiteHistory(
  siteId: Ref<SiteId>,
  timeWindow: Ref<ChartWindow>,
  customRange: Ref<HistoryRange | null> = ref(null)
) {
  const { data, pending, error } = useFetch<Reading[]>(
    () => {
      const { from, to } = timeWindow.value === 'custom' && customRange.value
        ? customRange.value
        : timeRange(timeWindow.value === '24h' ? '24h' : '7j')
      return `/api/sites/${siteId.value}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    },
    { watch: [siteId, timeWindow, customRange] }
  )
  const route = useRoute()
  watchFetchError(error, {
    url: () => `/api/sites/${siteId.value}/history`,
    route: () => route.path,
  })
  const readings = computed(() => data.value ?? [])
  return { readings, pending, error }
}
