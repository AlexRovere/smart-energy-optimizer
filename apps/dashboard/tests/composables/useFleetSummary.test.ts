import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useFleetSummary } from '../../app/composables/useFleetSummary'

const { mockUseFetch } = vi.hoisted(() => {
  const mockUseFetch = vi.fn()
  return { mockUseFetch }
})

vi.mock('nuxt/app', () => ({
  useFetch: mockUseFetch
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
})
