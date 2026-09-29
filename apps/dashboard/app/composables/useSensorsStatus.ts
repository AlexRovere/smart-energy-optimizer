import { useFetch, useRoute } from 'nuxt/app'
import { computed, onMounted, onUnmounted } from 'vue'
import type { SensorsStatus } from '~~/shared/sensorStatusSchema'
import { observerErreurFetch } from '../utils/erreurFetch'
import { normalizeSensors } from '../utils/sensors'
import { POLLING_INTERVAL_MS } from './useFleetSummary'

export function useSensorsStatus() {
  const { data, pending, error, refresh } = useFetch<SensorsStatus>('/api/sensors/status')
  const route = useRoute()

  onMounted(() => {
    const timer = setInterval(() => refresh(), POLLING_INTERVAL_MS)
    onUnmounted(() => clearInterval(timer))
  })

  observerErreurFetch(error, { url: '/api/sensors/status', route: () => route.path })

  const sensors = computed(() => normalizeSensors(data.value))
  return { sensors, pending, error, refresh }
}
