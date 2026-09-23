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
  ],
}

describe('useSitePrediction', () => {
  beforeEach(() => {
    mockUseFetch.mockReset()
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(null),
    })
  })

  it('retourne forecastPoints=[] quand data est null', () => {
    const { forecastPoints } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(forecastPoints.value).toEqual([])
  })

  it('retourne forecastPoints depuis data.predictions', () => {
    mockUseFetch.mockReturnValue({
      data: ref(prédictionFixture),
      pending: ref(false),
      error: ref(null),
    })
    const { forecastPoints } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(forecastPoints.value).toEqual(prédictionFixture.predictions)
  })

  it('expose modelVersion depuis data.model_version', () => {
    mockUseFetch.mockReturnValue({
      data: ref(prédictionFixture),
      pending: ref(false),
      error: ref(null),
    })
    const { modelVersion } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(modelVersion.value).toBe('3')
  })

  it('expose modelVersion=null quand data est null', () => {
    const { modelVersion } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(modelVersion.value).toBeNull()
  })

  it('available=true quand error est null', () => {
    const { available } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(available.value).toBe(true)
  })

  it('available=false quand error est défini', () => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(new Error('503 Service Unavailable')),
    })
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
    mockUseFetch.mockReturnValue({
      data: ref({ ...prédictionFixture, confidence_level: 0.9 }),
      pending: ref(false),
      error: ref(null),
    })
    const { confidenceLevel } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(confidenceLevel.value).toBe(0.9)
  })

  it('confidenceLevel=0 quand confidence_level absent de data', () => {
    mockUseFetch.mockReturnValue({
      data: ref(prédictionFixture),
      pending: ref(false),
      error: ref(null),
    })
    const { confidenceLevel } = useSitePrediction(ref<SiteId>('SITE001'))
    expect(confidenceLevel.value).toBe(0)
  })

  it('passe watch: [siteId, horizonHeures] à useFetch', () => {
    const siteId = ref<SiteId>('SITE001')
    const horizon = ref(24)
    useSitePrediction(siteId, horizon)
    const opts = mockUseFetch.mock.calls[0]![1]
    expect(opts.watch).toContain(siteId)
    expect(opts.watch).toContain(horizon)
  })

  describe('journalisation des erreurs', () => {
    afterEach(() => vi.restoreAllMocks())

    it('loggue sur console.error quand error passe de null à une Error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const errorRef = ref<Error | null>(null)
      mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: errorRef })

      useSitePrediction(ref<SiteId>('SITE001'))

      errorRef.value = new Error('503 Service Unavailable')
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledOnce()
    })

    it('ne loggue pas quand error reste null', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: ref(null) })

      useSitePrediction(ref<SiteId>('SITE001'))
      await nextTick()

      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })
})
