import { useFetch } from 'nuxt/app'
import { computed } from 'vue'
import type { Ref } from 'vue'
import type { Reading, SiteId } from '../types/api'

function plage(fenêtre: '24h' | '7j') {
  const to = new Date()
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
  const readings = computed(() => data.value ?? [])
  return { readings, pending, error }
}
