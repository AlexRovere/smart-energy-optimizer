import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { SiteId } from '../../app/types/api'
import { useSitePrediction } from '../../app/composables/useSitePrediction'

const mockUseFetch = vi.hoisted(() => vi.fn())
mockNuxtImport('useFetch', () => mockUseFetch)
mockNuxtImport('useRoute', () => () => ({ path: '/sites/SITE001' }))

const prédictionFixture = {
  site_id: 'SITE001' as SiteId,
  predicted_at: '2026-09-23T10:00:00Z',
  horizon_hours: 24,
  granularity: 'hour' as const,
  model_version: '3',
  predictions: [
    { timestamp: '2026-09-23T11:00:00Z', predicted_consumption_kw: 87.5 },
    { timestamp: '2026-09-23T12:00:00Z', predicted_consumption_kw: 91.2 },
  ],
}

function retourUseFetch(surcharges: Record<string, unknown> = {}) {
  return {
    data: ref(null),
    pending: ref(false),
    error: ref(null),
    execute: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    ...surcharges,
  }
}

describe('useSitePrediction', () => {
  beforeEach(() => {
    mockUseFetch.mockReset()
    mockUseFetch.mockReturnValue(retourUseFetch())
  })

  it('retourne forecastPoints=[] quand data est null', () => {
    const { forecastPoints } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(forecastPoints.value).toEqual([])
  })

  it('retourne forecastPoints depuis data.predictions', () => {
    mockUseFetch.mockReturnValue(retourUseFetch({ data: ref(prédictionFixture) }))
    const { forecastPoints } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(forecastPoints.value).toEqual(prédictionFixture.predictions)
  })

  it('expose modelVersion depuis data.model_version', () => {
    mockUseFetch.mockReturnValue(retourUseFetch({ data: ref(prédictionFixture) }))
    const { modelVersion } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(modelVersion.value).toBe('3')
  })

  it('expose modelVersion=null quand data est null', () => {
    const { modelVersion } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(modelVersion.value).toBeNull()
  })

  it('expose predictedAt et nbPoints depuis la réponse', () => {
    mockUseFetch.mockReturnValue(retourUseFetch({ data: ref(prédictionFixture) }))
    const { predictedAt, nbPoints } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(predictedAt.value).toBe('2026-09-23T10:00:00Z')
    expect(nbPoints.value).toBe(2)
  })

  it('predictedAt=null et nbPoints=0 tant que rien n\'est revenu', () => {
    const { predictedAt, nbPoints } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(predictedAt.value).toBeNull()
    expect(nbPoints.value).toBe(0)
  })

  it('available=true quand error est null', () => {
    const { available } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(available.value).toBe(true)
  })

  it('available=false quand error est défini', () => {
    mockUseFetch.mockReturnValue(retourUseFetch({ error: ref(new Error('503 Service Unavailable')) }))
    const { available } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(available.value).toBe(false)
  })

  it("passe method: 'POST' à useFetch", () => {
    useSitePrediction(ref<SiteId>('SITE001'))
    const opts = mockUseFetch.mock.calls[0]![1]
    expect(opts.method).toBe('POST')
  })

  it('passe body avec horizon_hours=24 par défaut', () => {
    useSitePrediction(ref<SiteId>('SITE001'))
    const opts = mockUseFetch.mock.calls[0]![1]
    const body = typeof opts.body?.value === 'object' ? opts.body.value : opts.body
    expect(body).toMatchObject({ horizon_hours: 24 })
  })

  it("l'URL cible /api/sites/{siteId}/prediction", () => {
    useSitePrediction(ref<SiteId>('SITE001'))
    const urlArg = mockUseFetch.mock.calls[0]![0] as () => string
    const url = typeof urlArg === 'function' ? urlArg() : urlArg
    expect(url).toContain('/api/sites/SITE001/prediction')
  })

  it("l'URL s'adapte quand siteId change", () => {
    const siteId = ref<SiteId>('SITE001')
    useSitePrediction(siteId)
    const urlArg = mockUseFetch.mock.calls[0]![0] as () => string
    expect(urlArg()).toContain('SITE001')
    siteId.value = 'SITE002'
    expect(urlArg()).toContain('SITE002')
  })

  it('confidenceLevel=0 quand data est null', () => {
    const { confidenceLevel } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(confidenceLevel.value).toBe(0)
  })

  it('expose confidenceLevel depuis data.confidence_level', () => {
    mockUseFetch.mockReturnValue(retourUseFetch({ data: ref({ ...prédictionFixture, confidence_level: 0.9 }) }))
    const { confidenceLevel } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(confidenceLevel.value).toBe(0.9)
  })

  describe('déclenchement manuel', () => {
    it("ne lance pas l'appel à l'ouverture (immediate: false)", () => {
      useSitePrediction(ref<SiteId>('SITE001'))
      const opts = mockUseFetch.mock.calls[0]![1]
      expect(opts.immediate).toBe(false)
    })

    it('ne relance pas seul quand le site ou l\'horizon change (watch: false)', () => {
      useSitePrediction(ref<SiteId>('SITE001'), ref(24))
      const opts = mockUseFetch.mock.calls[0]![1]
      expect(opts.watch).toBe(false)
    })

    it('lancee=false tant que lancer() n\'a pas été appelé', () => {
      const { lancee } = useSitePrediction(ref<SiteId>('SITE001'))
      expect(lancee.value).toBe(false)
    })

    it('lancer() appelle execute et passe lancee à true', async () => {
      const retour = retourUseFetch()
      mockUseFetch.mockReturnValue(retour)
      const { lancer, lancee } = useSitePrediction(ref<SiteId>('SITE001'))
      await lancer()
      expect(retour.execute).toHaveBeenCalledOnce()
      expect(lancee.value).toBe(true)
    })

    it('lancer() mesure la durée de l\'appel en millisecondes', async () => {
      const { lancer, dureeMs } = useSitePrediction(ref<SiteId>('SITE001'))
      expect(dureeMs.value).toBeNull()
      await lancer()
      expect(typeof dureeMs.value).toBe('number')
      expect(dureeMs.value).toBeGreaterThanOrEqual(0)
    })

    it('changer de site efface le résultat et revient à l\'état non lancé', async () => {
      const retour = retourUseFetch()
      mockUseFetch.mockReturnValue(retour)
      const siteId = ref<SiteId>('SITE001')
      const { lancer, lancee, dureeMs } = useSitePrediction(siteId)
      await lancer()

      siteId.value = 'SITE002'
      await nextTick()

      expect(lancee.value).toBe(false)
      expect(dureeMs.value).toBeNull()
      expect(retour.clear).toHaveBeenCalled()
    })

    it('changer d\'horizon efface aussi le résultat', async () => {
      const retour = retourUseFetch()
      mockUseFetch.mockReturnValue(retour)
      const horizon = ref(24)
      const { lancer, lancee } = useSitePrediction(ref<SiteId>('SITE001'), horizon)
      await lancer()

      horizon.value = 48
      await nextTick()

      expect(lancee.value).toBe(false)
      expect(retour.clear).toHaveBeenCalled()
    })
  })

  describe('journalisation des erreurs', () => {
    afterEach(() => vi.restoreAllMocks())

    it('loggue sur console.error quand error passe de null à une Error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const errorRef = ref<Error | null>(null)
      mockUseFetch.mockReturnValue(retourUseFetch({ error: errorRef }))

      useSitePrediction(ref<SiteId>('SITE001'))

      errorRef.value = new Error('503 Service Unavailable')
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledOnce()
    })

    it('ne loggue pas quand error reste null', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      useSitePrediction(ref<SiteId>('SITE001'))
      await nextTick()

      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })
})
