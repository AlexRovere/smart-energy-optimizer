import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useSitesList } from '../../app/composables/useSitesList'

const { mockUseFetch } = vi.hoisted(() => {
  const mockUseFetch = vi.fn()
  return { mockUseFetch }
})

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch,
  useRoute: () => ({ path: '/sites' })
}))

const sitesFixture = [
  {
    site_id: 'SITE001',
    site_name: 'Bureau Paris La Défense',
    site_type: 'office',
    location: 'Paris, France',
    capacity_kw: 300,
    status: 'active',
    warning_threshold_kw: 240,
    present_in_source: true
  }
]

describe('useSitesList', () => {
  beforeEach(() => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(null)
    })
  })

  it('retourne un tableau vide quand data est null', () => {
    const { sites } = useSitesList()
    expect(sites.value).toEqual([])
  })

  it('retourne les sites depuis data', () => {
    mockUseFetch.mockReturnValue({
      data: ref(sitesFixture),
      pending: ref(false),
      error: ref(null)
    })
    const { sites } = useSitesList()
    expect(sites.value).toEqual(sitesFixture)
  })

  it('appelle useFetch sur /api/sites', () => {
    useSitesList()
    expect(mockUseFetch).toHaveBeenCalledWith('/api/sites')
  })

  it('expose pending tel quel', () => {
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(true),
      error: ref(null)
    })
    const { pending } = useSitesList()
    expect(pending.value).toBe(true)
  })

  it('expose error tel quel', () => {
    const failure = new Error('réseau')
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(failure)
    })
    const { error } = useSitesList()
    expect(error.value).toBe(failure)
  })

  describe('journalisation des erreurs', () => {
    afterEach(() => vi.restoreAllMocks())

    it('loggue sur console.error quand error passe de null à une Error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const errorRef = ref<Error | null>(null)
      mockUseFetch.mockReturnValue({ data: ref(null), pending: ref(false), error: errorRef })

      useSitesList()

      errorRef.value = new Error('503 sites indisponibles')
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledOnce()
      const [, responseData] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>]
      expect(responseData.message).toBe('503 sites indisponibles')
    })
  })
})
