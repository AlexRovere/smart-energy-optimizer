import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFetchMockApi } = vi.hoisted(() => {
  const mockFetchMockApi = vi.fn()
  return { mockFetchMockApi }
})

vi.mock('../../../../server/utils/mockApiClient', () => ({
  fetchMockApi: mockFetchMockApi
}))

import handler from '../../../../server/api/stats/summary.get'
import { createError } from 'h3'

const summaryValide = {
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

// Événement H3 minimal — la route ne lit pas l'événement (void event)
const mockEvent = {} as Parameters<typeof handler>[0]

describe('GET /api/stats/summary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne le ParkSummary validé quand la source répond', async () => {
    mockFetchMockApi.mockResolvedValue(summaryValide)
    const résultat = await handler(mockEvent)
    expect(résultat).toMatchObject({ total_sites: 7, excluded_sites: ['SITE004'] })
  })

  it('inclut excluded_sites dans la réponse même si vide', async () => {
    mockFetchMockApi.mockResolvedValue({ ...summaryValide, excluded_sites: [] })
    const résultat = await handler(mockEvent)
    expect((résultat as typeof summaryValide).excluded_sites).toEqual([])
  })

  it('lève une erreur 502 si la source renvoie une forme inattendue', async () => {
    mockFetchMockApi.mockResolvedValue({ inattendu: true })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 502 })
  })

  it('lève une erreur 503 si la source est indisponible', async () => {
    mockFetchMockApi.mockRejectedValue(createError({ status: 503 }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })
})
