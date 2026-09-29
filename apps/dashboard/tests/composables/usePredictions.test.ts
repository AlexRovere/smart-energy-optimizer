import { describe, expect, it, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { PredictionPoint, Reading, Recommendation, SiteId } from '../../app/types/api'
import { usePredictions } from '../../app/composables/usePredictions'

const { mockUseFetch, mockUseSitePrediction, mockUseSiteHistory, points, readingsFixture } = vi.hoisted(() => ({
  mockUseFetch: vi.fn(),
  mockUseSitePrediction: vi.fn(),
  mockUseSiteHistory: vi.fn(),
  points: { value: [] as PredictionPoint[] },
  readingsFixture: { value: [] as Reading[] },
}))

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch
}))

vi.mock('../../app/composables/useSitePrediction', () => ({
  useSitePrediction: mockUseSitePrediction
}))

vi.mock('../../app/composables/useSiteHistory', () => ({
  useSiteHistory: mockUseSiteHistory
}))

vi.mock('../../app/composables/useSites', () => ({
  useSites: () => ({
    getSiteInfo: (id: SiteId) => ({ site_id: id, site_name: 'Bureau Paris La Défense', threshold_kw: 100 })
  })
}))

const recommendationFixture: Recommendation = {
  recommendation_id: 'REC-SITE001-conso-2026-09-18T10:00:00.000Z',
  site_id: 'SITE001',
  source: 'threshold',
  type: 'efficiency',
  priority: 'medium',
  title: 'Consommation moyenne élevée',
  description: 'La moyenne glissante dépasse le seuil réglé.',
  trigger: { timestamp: '2026-09-18T10:00:00.000Z', value_kw: 230, threshold_kw: 200 },
  estimated_saving_kwh: 0,
  gain_kw: 0,
  confidence: 0,
  window: 'N/A'
}

function forecast(values: number[]): PredictionPoint[] {
  return values.map((kw, i) => ({
    timestamp: new Date(Date.UTC(2026, 8, 23, 11 + i)).toISOString(),
    predicted_consumption_kw: kw
  }))
}

describe('usePredictions', () => {
  beforeEach(() => {
    mockUseFetch.mockReset()
    mockUseFetch.mockReturnValue({
      data: ref({ recommendations: [recommendationFixture], unavailable: [] }),
      pending: ref(false),
      error: ref(null)
    })
    points.value = []
    readingsFixture.value = []
    mockUseSitePrediction.mockReset()
    mockUseSitePrediction.mockImplementation(() => ({
      forecastPoints: computed(() => points.value),
      modelVersion: ref('3'),
      confidenceLevel: ref(0),
      predictedAt: ref(null),
      nbPoints: computed(() => points.value.length),
      available: ref(true),
      launch: vi.fn(),
      launched: ref(false),
      durationMs: ref(null),
      pending: ref(false),
      error: ref(null)
    }))
    mockUseSiteHistory.mockReset()
    mockUseSiteHistory.mockImplementation(() => ({
      readings: computed(() => readingsFixture.value),
      pending: ref(false),
      error: ref(null)
    }))
  })

  it('sélectionne SITE001 par défaut, horizon 24 h', () => {
    const { selectedSiteId, horizonHours } = usePredictions()
    expect(selectedSiteId.value).toBe('SITE001')
    expect(horizonHours.value).toBe(24)
  })

  it('branche la prévision du service ML sur le site et l\'horizon sélectionnés', () => {
    const { selectedSiteId, horizonHours } = usePredictions()
    const [siteArg, horizonArg] = mockUseSitePrediction.mock.calls[0]! as [Ref<SiteId>, Ref<number>]
    expect(siteArg).toBe(selectedSiteId)
    expect(horizonArg).toBe(horizonHours)
  })

  it("prend l'historique réel des 24 dernières heures du site sélectionné", () => {
    const { selectedSiteId } = usePredictions()
    const [siteArg, timeWindowArg] = mockUseSiteHistory.mock.calls[0]! as [Ref<SiteId>, Ref<string>]
    expect(siteArg).toBe(selectedSiteId)
    expect(timeWindowArg.value).toBe('24h')
  })

  it('expose les points historiques rendus par useSiteHistory', () => {
    readingsFixture.value = [{ timestamp: '2026-09-23T10:00:00Z', consumption_kw: 80 } as Reading]
    const { historicalPoints } = usePredictions()
    expect(historicalPoints.value).toEqual(readingsFixture.value)
  })

  it('expose le déclencheur et le retour de la prédiction', () => {
    const result = usePredictions()
    expect(typeof result.launch).toBe('function')
    expect(result.launched.value).toBe(false)
    expect(result.modelVersion.value).toBe('3')
  })

  describe('indicateurs', () => {
    it('peakKw, marginKw et peakTime valent null tant que la prévision est vide', () => {
      const { peakKw, marginKw, peakTime, exceedanceExpected } = usePredictions()
      expect(peakKw.value).toBeNull()
      expect(marginKw.value).toBeNull()
      expect(peakTime.value).toBeNull()
      expect(exceedanceExpected.value).toBe(false)
    })

    it('peakKw est le maximum de la prévision', () => {
      points.value = forecast([80, 95, 90])
      const { peakKw } = usePredictions()
      expect(peakKw.value).toBe(95)
    })

    it('marginKw = seuil du site - pic', () => {
      points.value = forecast([80, 95, 90])
      const { marginKw, thresholdKw } = usePredictions()
      expect(thresholdKw.value).toBe(100)
      expect(marginKw.value).toBe(5)
    })

    it('peakTime donne l\'heure du pic', () => {
      points.value = forecast([80, 95, 90])
      const { peakTime } = usePredictions()
      expect(peakTime.value).toMatch(/^\d{2}:\d{2}$/)
    })

    it('exceedanceExpected=false quand tout reste sous le seuil', () => {
      points.value = forecast([80, 95, 90])
      const { exceedanceExpected } = usePredictions()
      expect(exceedanceExpected.value).toBe(false)
    })

    it('exceedanceExpected=true dès qu\'un point atteint le seuil', () => {
      points.value = forecast([80, 100, 90])
      const { exceedanceExpected } = usePredictions()
      expect(exceedanceExpected.value).toBe(true)
    })
  })

  describe('recommandations', () => {
    it('rend les recommandations telles que rendues par /api/sites/{id}/recommendations', () => {
      const { recommendations } = usePredictions()
      expect(recommendations.value).toEqual([recommendationFixture])
    })

    it('rend un tableau vide tant que la réponse n\'est pas arrivée', () => {
      mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(true), error: ref(null) })
      const { recommendations } = usePredictions()
      expect(recommendations.value).toEqual([])
    })

    it('suit le site sélectionné', () => {
      const { selectedSiteId } = usePredictions()
      const urlGetter = mockUseFetch.mock.calls[0]![0] as () => string
      expect(urlGetter()).toBe('/api/sites/SITE001/recommendations')
      selectedSiteId.value = 'SITE003'
      expect(urlGetter()).toBe('/api/sites/SITE003/recommendations')
      const opts = mockUseFetch.mock.calls[0]![1] as { watch: unknown[] }
      expect(opts.watch).toContain(selectedSiteId)
    })
  })
})
