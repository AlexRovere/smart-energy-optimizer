import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSensorsStatus } from '../../app/composables/useSensorsStatus'

const { mockUseFetch } = vi.hoisted(() => ({ mockUseFetch: vi.fn() }))

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch,
  useRoute: () => ({ path: '/' }),
}))

const ok = { status: 'ok', failing_until: null }

describe('useSensorsStatus', () => {
  beforeEach(() => {
    mockUseFetch.mockReset()
  })

  it("interroge la route d'état des capteurs", () => {
    mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: ref(null), refresh: vi.fn() })
    useSensorsStatus()
    expect(mockUseFetch).toHaveBeenCalledWith('/api/sensors/status')
  })

  it('rend la liste normalisée', () => {
    mockUseFetch.mockReturnValue({
      data: ref({ SITE001: { site_name: 'Bureau', overall: 'ok', sensors: { consumption: ok } } }),
      pending: ref(false), error: ref(null), refresh: vi.fn(),
    })
    const { sensors } = useSensorsStatus()
    expect(sensors.value).toEqual([
      { site_id: 'SITE001', site_name: 'Bureau', overall: 'ok', sensors: [{ family: 'consumption', status: 'ok', failing_until: null }] },
    ])
  })

  it('rend une liste vide tant que rien n’est arrivé', () => {
    mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null), refresh: vi.fn() })
    expect(useSensorsStatus().sensors.value).toEqual([])
  })
})
