import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useFleetSummary, POLLING_INTERVAL_MS } from '../../app/composables/useFleetSummary'

const { mockUseFetch } = vi.hoisted(() => {
  const mockUseFetch = vi.fn()
  return { mockUseFetch }
})

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch,
  useRoute: () => ({ path: '/' })
}))

const parkSummaryFixture = {
  timestamp: '2026-09-16T14:32:00Z',
  total_sites: 7,
  excluded_sites: ['SITE004'],
  total_consumption_kw: 1842.30,
  total_capacity_kw: 4130,
  average_load_percent: 44.6,
  sites: [
    {
      site_id: 'SITE001',
      site_name: 'Bureau Paris La Défense',
      current_consumption_kw: 87.34,
      capacity_kw: 200,
      load_percent: 43.7,
      data_quality: 'good'
    }
  ]
}

describe('useFleetSummary', () => {
  beforeEach(() => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(null)
    })
  })

  it('retourne summary null quand data est null', () => {
    const { summary } = useFleetSummary()
    expect(summary.value).toBeNull()
  })

  it('normalise average_load_percent en avg_load_pct', () => {
    mockUseFetch.mockReturnValue({
      data: ref(parkSummaryFixture),
      pending: ref(false),
      error: ref(null)
    })
    const { summary } = useFleetSummary()
    expect(summary.value?.avg_load_pct).toBe(44.6)
  })

  it('normalise total_sites en sites_total', () => {
    mockUseFetch.mockReturnValue({
      data: ref(parkSummaryFixture),
      pending: ref(false),
      error: ref(null)
    })
    const { summary } = useFleetSummary()
    expect(summary.value?.sites_total).toBe(7)
  })

  it('calcule sites_counted = total_sites - excluded_sites.length', () => {
    mockUseFetch.mockReturnValue({
      data: ref(parkSummaryFixture),
      pending: ref(false),
      error: ref(null)
    })
    const { summary } = useFleetSummary()
    expect(summary.value?.sites_counted).toBe(6)
  })

  it('retransmet excluded_sites tel quel', () => {
    mockUseFetch.mockReturnValue({
      data: ref(parkSummaryFixture),
      pending: ref(false),
      error: ref(null)
    })
    const { summary } = useFleetSummary()
    expect(summary.value?.excluded_sites).toEqual(['SITE004'])
  })

  it('pending reflète l\'état de useFetch', () => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(true),
      error: ref(null)
    })
    const { pending } = useFleetSummary()
    expect(pending.value).toBe(true)
  })

  it('POLLING_INTERVAL_MS est un entier positif', () => {
    expect(POLLING_INTERVAL_MS).toBeGreaterThan(0)
    expect(Number.isInteger(POLLING_INTERVAL_MS)).toBe(true)
  })

  it('POLLING_INTERVAL_MS vaut 30 000 ms', () => {
    expect(POLLING_INTERVAL_MS).toBe(30_000)
  })

  describe('journalisation des erreurs', () => {
    afterEach(() => vi.restoreAllMocks())

    it('loggue sur console.error quand error passe de null à une Error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const errorRef = ref<Error | null>(null)
      mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: errorRef, refresh: vi.fn() })

      useFleetSummary()

      errorRef.value = new Error('503 Source indisponible')
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledOnce()
      const [, responseData] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
      expect(responseData.message).toBe('503 Source indisponible')
    })
  })
})

describe('useFleetSummary : heure de rafraîchissement', () => {
  afterEach(() => { vi.useRealTimers() })

  it('date chaque réponse reçue, pas le timestamp de la source', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-29T14:32:00Z'))
    const data = ref<unknown>(null)
    mockUseFetch.mockReturnValue({ data, pending: ref(false), error: ref(null), refresh: vi.fn() })
    const { refreshedAt } = useFleetSummary()
    expect(refreshedAt.value).toBeNull()

    data.value = { ...parkSummaryFixture }
    await nextTick()

    expect(refreshedAt.value).toBe(Date.parse('2026-09-29T14:32:00Z'))
  })

  it("signale l'échec du dernier rafraîchissement", () => {
    mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: ref(new Error('503')), refresh: vi.fn() })
    const { refreshFailed } = useFleetSummary()
    expect(refreshFailed.value).toBe(true)
  })

  it('expose le rafraîchissement manuel', () => {
    const refresh = vi.fn()
    mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: ref(null), refresh })
    useFleetSummary().refresh()
    expect(refresh).toHaveBeenCalledOnce()
  })
})
