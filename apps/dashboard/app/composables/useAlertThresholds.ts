import { computed } from 'vue'
import { useFetch } from 'nuxt/app'
import type { AlertThresholdEntry, AlertThresholdInput, AlertThresholdType } from '~~/shared/alertThresholdSchema'

export function useAlertThresholds() {
  const { data, pending, error, refresh } = useFetch<AlertThresholdEntry[]>('/api/alert-thresholds')
  const thresholds = computed(() => data.value ?? [])

  async function save(siteId: string, type: AlertThresholdType, valeurs: AlertThresholdInput) {
    await $fetch(`/api/sites/${siteId}/alert-thresholds/${type}`, { method: 'PUT', body: valeurs })
    await refresh()
  }

  return { thresholds, pending, error, save }
}
