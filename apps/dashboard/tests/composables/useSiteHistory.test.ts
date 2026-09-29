import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { SiteId } from '../../app/types/api'
import { useSiteHistory } from '../../app/composables/useSiteHistory'

const { mockUseFetch } = vi.hoisted(() => {
  const mockUseFetch = vi.fn()
  return { mockUseFetch }
})

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch,
  useRoute: () => ({ path: '/sites/SITE001' })
}))

const readingFixture = {
  timestamp: '2026-09-16T14:00:00Z',
  site_id: 'SITE001',
  consumption_kw: 87.34,
  null_reasons: [],
  data_quality: 'good'
}

describe('useSiteHistory', () => {
  beforeEach(() => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(null)
    })
  })

  it('retourne [] quand data est null', () => {
    const { readings } = useSiteHistory(ref<SiteId>('SITE001'), ref('24h'))
    expect(readings.value).toEqual([])
  })

  it('retourne les mesures quand data est fourni', () => {
    mockUseFetch.mockReturnValue({
      data: ref([readingFixture]),
      pending: ref(false),
      error: ref(null)
    })
    const { readings } = useSiteHistory(ref<SiteId>('SITE001'), ref('24h'))
    expect(readings.value).toEqual([readingFixture])
  })

  it("l'URL pour '24h' couvre les 24 dernières heures", () => {
    useSiteHistory(ref<SiteId>('SITE001'), ref('24h'))
    const urlGetter = mockUseFetch.mock.calls[0]![0] as () => string
    const url = urlGetter()
    expect(url).toContain('/api/sites/SITE001/history')
    const fromMatch = url.match(/from=([^&]+)/)!
    const toMatch = url.match(/to=([^&]+)/)!
    const from = new Date(decodeURIComponent(fromMatch[1]!))
    const to = new Date(decodeURIComponent(toMatch[1]!))
    const diffHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60)
    expect(diffHours).toBeCloseTo(24, 0)
  })

  it("l'URL pour '7j' couvre 7 jours", () => {
    useSiteHistory(ref<SiteId>('SITE001'), ref('7j'))
    const urlGetter = mockUseFetch.mock.calls[0]![0] as () => string
    const url = urlGetter()
    const fromMatch = url.match(/from=([^&]+)/)!
    const toMatch = url.match(/to=([^&]+)/)!
    const from = new Date(decodeURIComponent(fromMatch[1]!))
    const to = new Date(decodeURIComponent(toMatch[1]!))
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(7, 0)
  })

  it("l'URL d'une plage choisie reprend ses bornes", () => {
    const range = ref({ from: '2026-09-01T00:00:00.000Z', to: '2026-09-16T00:00:00.000Z' })
    useSiteHistory(ref<SiteId>('SITE001'), ref('custom'), range)
    const url = (mockUseFetch.mock.calls[0]![0] as () => string)()
    expect(decodeURIComponent(url)).toContain('from=2026-09-01T00:00:00.000Z&to=2026-09-16T00:00:00.000Z')
  })

  it('recharge quand la plage choisie change', () => {
    const range = ref({ from: '2026-09-01T00:00:00.000Z', to: '2026-09-16T00:00:00.000Z' })
    useSiteHistory(ref<SiteId>('SITE001'), ref('custom'), range)
    const opts = mockUseFetch.mock.calls[0]![1] as { watch: unknown[] }
    expect(opts.watch).toContain(range)
  })

  it('passe watch: [siteId, fenêtre] à useFetch', () => {
    const siteId = ref<SiteId>('SITE001')
    const timeWindow = ref<'24h' | '7j'>('24h')
    useSiteHistory(siteId, timeWindow)
    const opts = mockUseFetch.mock.calls[0]![1] as { watch: unknown[] }
    expect(opts.watch).toContain(siteId)
    expect(opts.watch).toContain(timeWindow)
  })

  it("l'URL s'adapte quand siteId change", () => {
    const siteId = ref<SiteId>('SITE001')
    useSiteHistory(siteId, ref('24h'))
    const urlGetter = mockUseFetch.mock.calls[0]![0] as () => string
    expect(urlGetter()).toContain('SITE001')
    siteId.value = 'SITE002'
    expect(urlGetter()).toContain('SITE002')
  })

  it("l'URL factory est stable entre deux appels successifs (SSR / hydratation)", () => {
    useSiteHistory(ref<SiteId>('SITE001'), ref('24h'))
    const urlGetter = mockUseFetch.mock.calls[0]![0] as () => string
    expect(urlGetter()).toBe(urlGetter())
  })

  describe('journalisation des erreurs', () => {
    afterEach(() => vi.restoreAllMocks())

    it('loggue sur console.error quand error passe de null à une Error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const errorRef = ref<Error | null>(null)
      mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: errorRef })

      useSiteHistory(ref<SiteId>('SITE001'), ref<'24h' | '7j'>('24h'))

      errorRef.value = new Error('503 Service Unavailable')
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledOnce()
      const [, responseData] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
      expect(responseData.message).toBe('503 Service Unavailable')
      expect(typeof responseData.route).toBe('string')
      expect(typeof responseData.url).toBe('string')
    })

    it('ne loggue pas quand error reste null', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: ref(null) })

      useSiteHistory(ref<SiteId>('SITE001'), ref<'24h' | '7j'>('24h'))
      await nextTick()

      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })
})
