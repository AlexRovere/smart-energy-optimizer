import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useHealth } from '../../app/composables/useHealth'

const { mockUseFetch } = vi.hoisted(() => ({ mockUseFetch: vi.fn() }))

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch,
  useRoute: () => ({ path: '/' }),
}))

describe('useHealth', () => {
  beforeEach(() => mockUseFetch.mockReset())

  it('interroge la route de santé', () => {
    mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: ref(null), refresh: vi.fn() })
    useHealth()
    expect(mockUseFetch).toHaveBeenCalledWith('/api/health')
  })

  it("rend l'état tel que la route le donne", () => {
    const health = { status: 'degraded', db: 'ok', parquet: 'unavailable', version: 'dev', uptime: 12, last_data_at: null }
    mockUseFetch.mockReturnValue({ data: ref(health), pending: ref(false), error: ref(null), refresh: vi.fn() })
    expect(useHealth().health.value).toEqual(health)
  })

  it("considère le service en panne quand la route elle-même ne répond pas", () => {
    mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: ref(new Error('fetch failed')), refresh: vi.fn() })
    expect(useHealth().health.value).toMatchObject({ status: 'down' })
  })
})
