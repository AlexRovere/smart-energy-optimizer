import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useSitesList } from '../../app/composables/useSitesList'

const { mockUseFetch } = vi.hoisted(() => {
  const mockUseFetch = vi.fn()
  return { mockUseFetch }
})

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch
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
    const erreur = new Error('réseau')
    mockUseFetch.mockReturnValue({
      data: ref(null),
      pending: ref(false),
      error: ref(erreur)
    })
    const { error } = useSitesList()
    expect(error.value).toBe(erreur)
  })
})
