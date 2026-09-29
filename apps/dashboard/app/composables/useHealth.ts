import { useFetch } from 'nuxt/app'
import { computed, onMounted, onUnmounted } from 'vue'

export interface HealthState {
  status: 'ok' | 'degraded' | 'down'
  db: 'ok' | 'unavailable'
  parquet: 'ok' | 'unavailable'
  version: string
  uptime: number
  last_data_at: string | null
}

const HEALTH_INTERVAL_MS = 60_000

// Une route de santé qui ne répond pas dit déjà l'essentiel : le service est
// injoignable. L'afficher en panne vaut mieux qu'un pied de page vide.
const UNREACHABLE: HealthState = {
  status: 'down', db: 'unavailable', parquet: 'unavailable', version: '', uptime: 0, last_data_at: null,
}

export function useHealth() {
  const { data, error, refresh } = useFetch<HealthState>('/api/health')

  onMounted(() => {
    const timer = setInterval(() => refresh(), HEALTH_INTERVAL_MS)
    onUnmounted(() => clearInterval(timer))
  })

  const health = computed<HealthState | null>(() => {
    if (error.value) return UNREACHABLE
    return data.value ?? null
  })
  return { health, refresh }
}
