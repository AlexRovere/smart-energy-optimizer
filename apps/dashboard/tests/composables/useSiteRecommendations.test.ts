import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { SiteId } from '../../app/types/api'
import type { Recommendation } from '../../shared/recommendationSchema'
import { useSiteRecommendations } from '../../app/composables/useSiteRecommendations'

const useFetchMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useFetch', () => useFetchMock)

const RECOMMENDATION: Recommendation = {
  recommendation_id: 'REC-SITE001-pic-2026-09-18T10:00:00.000Z',
  site_id: 'SITE001',
  source: 'threshold',
  type: 'load_balancing',
  priority: 'high',
  title: 'Lisser le pic de consommation',
  description: 'Décaler les charges non prioritaires',
  trigger: { timestamp: '2026-09-18T10:00:00.000Z', value_kw: 310, threshold_kw: 300 },
  estimated_saving_kwh: 0,
  gain_kw: 0,
  confidence: 0,
  window: 'N/A'
}

describe('useSiteRecommendations', () => {
  beforeEach(() => useFetchMock.mockReset())

  it('appelle useFetch avec /api/sites/SITE001/recommendations', () => {
    useFetchMock.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null) })
    const id = ref<SiteId>('SITE001')

    useSiteRecommendations(id)

    const urlArg = useFetchMock.mock.calls[0]![0]
    const url = typeof urlArg === 'function' ? urlArg() : urlArg
    expect(url).toBe('/api/sites/SITE001/recommendations')
  })

  it('passe watch: [id] pour recharger sur changement de site', () => {
    useFetchMock.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null) })
    const id = ref<SiteId>('SITE001')

    useSiteRecommendations(id)

    const options = useFetchMock.mock.calls[0]![1]
    expect(options?.watch).toEqual([id])
  })

  it('rend un tableau vide avant résolution', () => {
    useFetchMock.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null) })
    const { recommendations } = useSiteRecommendations(ref<SiteId>('SITE001'))
    expect(recommendations.value).toEqual([])
  })

  it('rend les recommandations reçues', () => {
    useFetchMock.mockReturnValue({ data: ref({ recommendations: [RECOMMENDATION], unavailable: [] }), pending: ref(false), error: ref(null) })
    const { recommendations } = useSiteRecommendations(ref<SiteId>('SITE001'))
    expect(recommendations.value).toEqual([RECOMMENDATION])
  })

  it('dit quelles sources ont manqué au calcul', () => {
    useFetchMock.mockReturnValue({ data: ref({ recommendations: [], unavailable: ['forecast'] }), pending: ref(false), error: ref(null) })
    const { unavailable } = useSiteRecommendations(ref<SiteId>('SITE001'))
    expect(unavailable.value).toEqual(['forecast'])
  })

  it("ne signale aucun manque avant résolution", () => {
    useFetchMock.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null) })
    const { unavailable } = useSiteRecommendations(ref<SiteId>('SITE001'))
    expect(unavailable.value).toEqual([])
  })
})
