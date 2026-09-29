import { describe, expect, it, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { PredictionPoint, Reading, Recommendation, SiteId } from '../../app/types/api'
import { usePredictions } from '../../app/composables/usePredictions'

const { mockUseFetch, mockUseSitePrediction, mockUseSiteHistory, points, lectures } = vi.hoisted(() => ({
  mockUseFetch: vi.fn(),
  mockUseSitePrediction: vi.fn(),
  mockUseSiteHistory: vi.fn(),
  points: { valeur: [] as PredictionPoint[] },
  lectures: { valeur: [] as Reading[] },
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

function prévision(valeurs: number[]): PredictionPoint[] {
  return valeurs.map((kw, i) => ({
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
    points.valeur = []
    lectures.valeur = []
    mockUseSitePrediction.mockReset()
    mockUseSitePrediction.mockImplementation(() => ({
      forecastPoints: computed(() => points.valeur),
      modelVersion: ref('3'),
      confidenceLevel: ref(0),
      predictedAt: ref(null),
      nbPoints: computed(() => points.valeur.length),
      available: ref(true),
      lancer: vi.fn(),
      lancee: ref(false),
      dureeMs: ref(null),
      pending: ref(false),
      error: ref(null)
    }))
    mockUseSiteHistory.mockReset()
    mockUseSiteHistory.mockImplementation(() => ({
      readings: computed(() => lectures.valeur),
      pending: ref(false),
      error: ref(null)
    }))
  })

  it('sélectionne SITE001 par défaut, horizon 24 h', () => {
    const { selectedSiteId, horizonHeures } = usePredictions()
    expect(selectedSiteId.value).toBe('SITE001')
    expect(horizonHeures.value).toBe(24)
  })

  it('branche la prévision du service ML sur le site et l\'horizon sélectionnés', () => {
    const { selectedSiteId, horizonHeures } = usePredictions()
    const [siteArg, horizonArg] = mockUseSitePrediction.mock.calls[0]! as [Ref<SiteId>, Ref<number>]
    expect(siteArg).toBe(selectedSiteId)
    expect(horizonArg).toBe(horizonHeures)
  })

  it("prend l'historique réel des 24 dernières heures du site sélectionné", () => {
    const { selectedSiteId } = usePredictions()
    const [siteArg, fenêtreArg] = mockUseSiteHistory.mock.calls[0]! as [Ref<SiteId>, Ref<string>]
    expect(siteArg).toBe(selectedSiteId)
    expect(fenêtreArg.value).toBe('24h')
  })

  it('expose les points historiques rendus par useSiteHistory', () => {
    lectures.valeur = [{ timestamp: '2026-09-23T10:00:00Z', consumption_kw: 80 } as Reading]
    const { historicalPoints } = usePredictions()
    expect(historicalPoints.value).toEqual(lectures.valeur)
  })

  it('expose le déclencheur et le retour de la prédiction', () => {
    const résultat = usePredictions()
    expect(typeof résultat.lancer).toBe('function')
    expect(résultat.lancee.value).toBe(false)
    expect(résultat.modelVersion.value).toBe('3')
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
      points.valeur = prévision([80, 95, 90])
      const { peakKw } = usePredictions()
      expect(peakKw.value).toBe(95)
    })

    it('marginKw = seuil du site - pic', () => {
      points.valeur = prévision([80, 95, 90])
      const { marginKw, thresholdKw } = usePredictions()
      expect(thresholdKw.value).toBe(100)
      expect(marginKw.value).toBe(5)
    })

    it('peakTime donne l\'heure du pic', () => {
      points.valeur = prévision([80, 95, 90])
      const { peakTime } = usePredictions()
      expect(peakTime.value).toMatch(/^\d{2}:\d{2}$/)
    })

    it('exceedanceExpected=false quand tout reste sous le seuil', () => {
      points.valeur = prévision([80, 95, 90])
      const { exceedanceExpected } = usePredictions()
      expect(exceedanceExpected.value).toBe(false)
    })

    it('exceedanceExpected=true dès qu\'un point atteint le seuil', () => {
      points.valeur = prévision([80, 100, 90])
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
