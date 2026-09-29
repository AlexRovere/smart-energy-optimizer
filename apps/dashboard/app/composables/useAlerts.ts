import { useFetch, useRoute } from 'nuxt/app'
import { computed, onMounted, onUnmounted } from 'vue'
import type { Alert } from '../types/api'
import { watchFetchError } from '../utils/fetchError'

const POLLING_INTERVAL_MS = 30_000

export function useAlerts() {
  const { data, pending, error, refresh } = useFetch<Alert[]>('/api/alerts')
  const route = useRoute()

  onMounted(() => {
    const timer = setInterval(() => refresh(), POLLING_INTERVAL_MS)
    onUnmounted(() => clearInterval(timer))
  })

  watchFetchError(error, {
    url: '/api/alerts',
    route: () => route.path,
  })

  const alerts = computed<Alert[]>(() => data.value ?? [])
  return { alerts, pending, error }
}
