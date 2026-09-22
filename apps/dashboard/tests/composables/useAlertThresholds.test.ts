import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useAlertThresholds } from '../../app/composables/useAlertThresholds'
import type { AlertThresholdEntry } from '../../shared/alertThresholdSchema'

const useFetchMock = vi.hoisted(() => vi.fn())
const fetchMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useFetch', () => useFetchMock)
mockNuxtImport('$fetch', () => fetchMock)

const FIXTURE: AlertThresholdEntry[] = [
  { site_id: 'SITE001', type: 'conso', duration: 5, threshold: 200 },
  { site_id: 'SITE001', type: 'pic', duration: 5, threshold: 1.5 }
]

describe('useAlertThresholds', () => {
  beforeEach(() => {
    useFetchMock.mockReset()
    fetchMock.mockReset()
  })

  it('appelle useFetch sur /api/alert-thresholds', () => {
    useFetchMock.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null), refresh: vi.fn() })

    useAlertThresholds()

    expect(useFetchMock).toHaveBeenCalledWith('/api/alert-thresholds')
  })

  it('rend un tableau vide avant résolution', () => {
    useFetchMock.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null), refresh: vi.fn() })

    const { thresholds } = useAlertThresholds()

    expect(thresholds.value).toEqual([])
  })

  it('rend les règles reçues', () => {
    useFetchMock.mockReturnValue({ data: ref(FIXTURE), pending: ref(false), error: ref(null), refresh: vi.fn() })

    const { thresholds } = useAlertThresholds()

    expect(thresholds.value).toEqual(FIXTURE)
  })

  it('save appelle PUT sur la route du site et du type, puis rafraîchit', async () => {
    const refresh = vi.fn()
    useFetchMock.mockReturnValue({ data: ref(FIXTURE), pending: ref(false), error: ref(null), refresh })
    fetchMock.mockResolvedValue({ site_id: 'SITE001', type: 'pic', duration: 8, threshold: 1.8 })

    const { save } = useAlertThresholds()
    await save('SITE001', 'pic', { duration: 8, threshold: 1.8 })

    expect(fetchMock).toHaveBeenCalledWith('/api/sites/SITE001/alert-thresholds/pic', {
      method: 'PUT',
      body: { duration: 8, threshold: 1.8 }
    })
    expect(refresh).toHaveBeenCalled()
  })
})
