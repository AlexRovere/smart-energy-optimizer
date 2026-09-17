import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { SiteId } from '../../app/types/api'
import { useSiteHistory } from '../../app/composables/useSiteHistory'

const { mockUseFetch } = vi.hoisted(() => {
  const mockUseFetch = vi.fn()
  return { mockUseFetch }
})

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch
}))

const mesureFixture = {
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
      data: ref([mesureFixture]),
      pending: ref(false),
      error: ref(null)
    })
    const { readings } = useSiteHistory(ref<SiteId>('SITE001'), ref('24h'))
    expect(readings.value).toEqual([mesureFixture])
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
    const diffHeures = (to.getTime() - from.getTime()) / (1000 * 60 * 60)
    expect(diffHeures).toBeCloseTo(24, 0)
  })

  it("l'URL pour '7j' couvre 7 jours", () => {
    useSiteHistory(ref<SiteId>('SITE001'), ref('7j'))
    const urlGetter = mockUseFetch.mock.calls[0]![0] as () => string
    const url = urlGetter()
    const fromMatch = url.match(/from=([^&]+)/)!
    const toMatch = url.match(/to=([^&]+)/)!
    const from = new Date(decodeURIComponent(fromMatch[1]!))
    const to = new Date(decodeURIComponent(toMatch[1]!))
    const diffJours = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffJours).toBeCloseTo(7, 0)
  })

  it('passe watch: [siteId, fenêtre] à useFetch', () => {
    const siteId = ref<SiteId>('SITE001')
    const fenêtre = ref<'24h' | '7j'>('24h')
    useSiteHistory(siteId, fenêtre)
    const opts = mockUseFetch.mock.calls[0]![1] as { watch: unknown[] }
    expect(opts.watch).toContain(siteId)
    expect(opts.watch).toContain(fenêtre)
  })

  it("l'URL s'adapte quand siteId change", () => {
    const siteId = ref<SiteId>('SITE001')
    useSiteHistory(siteId, ref('24h'))
    const urlGetter = mockUseFetch.mock.calls[0]![0] as () => string
    expect(urlGetter()).toContain('SITE001')
    siteId.value = 'SITE002'
    expect(urlGetter()).toContain('SITE002')
  })
})
