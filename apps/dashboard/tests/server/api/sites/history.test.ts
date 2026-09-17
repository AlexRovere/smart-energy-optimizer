import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

const { mockQuerySiteHistory, mockGetQuery, mockGetRouterParam } = vi.hoisted(() => {
  const mockQuerySiteHistory = vi.fn()
  const mockGetQuery = vi.fn()
  const mockGetRouterParam = vi.fn()
  return { mockQuerySiteHistory, mockGetQuery, mockGetRouterParam }
})

vi.mock('../../../../server/utils/parquetReader', () => ({
  querySiteHistory: mockQuerySiteHistory
}))

vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>()
  return {
    ...original,
    getQuery: mockGetQuery,
    getRouterParam: mockGetRouterParam
  }
})

import handler from '../../../../server/api/sites/[id]/history.get'

const mockEvent = {} as H3Event

function configurerÉvénement(siteId: string, params: Record<string, string>) {
  mockGetRouterParam.mockReturnValue(siteId)
  mockGetQuery.mockReturnValue(params)
}

const mesureFixture = {
  timestamp: '2026-09-16T14:00:00Z',
  site_id: 'SITE001',
  consumption_kw: 87.34,
  null_reasons: [],
  data_quality: 'good'
}

describe('GET /api/sites/[id]/history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne les mesures pour un id et une période valides', async () => {
    mockQuerySiteHistory.mockResolvedValue([mesureFixture])
    configurerÉvénement('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z'
    })
    const résultat = await handler(mockEvent)
    expect(résultat).toHaveLength(1)
    expect(mockQuerySiteHistory).toHaveBeenCalledWith('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 500)
  })

  it('retourne un tableau vide si aucune mesure sur la période', async () => {
    mockQuerySiteHistory.mockResolvedValue([])
    configurerÉvénement('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z'
    })
    const résultat = await handler(mockEvent)
    expect(résultat).toEqual([])
  })

  it('retourne 422 si l\'identifiant de site est invalide', async () => {
    configurerÉvénement('INVALID', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z'
    })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 si from est absent', async () => {
    configurerÉvénement('SITE001', { to: '2026-09-17T00:00:00Z' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 si to est absent', async () => {
    configurerÉvénement('SITE001', { from: '2026-09-16T00:00:00Z' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 si from est mal formé', async () => {
    configurerÉvénement('SITE001', {
      from: '16/09/2026',
      to: '2026-09-17T00:00:00Z'
    })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 si limit est hors domaine', async () => {
    configurerÉvénement('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z',
      limit: '2000'
    })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 503 si le répertoire Parquet est indisponible', async () => {
    mockQuerySiteHistory.mockRejectedValue(new Error("NUXT_PARQUET_DIR n'est pas défini"))
    configurerÉvénement('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z'
    })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('applique la limite personnalisée', async () => {
    mockQuerySiteHistory.mockResolvedValue([])
    configurerÉvénement('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z',
      limit: '100'
    })
    await handler(mockEvent)
    expect(mockQuerySiteHistory).toHaveBeenCalledWith('SITE001', expect.any(String), expect.any(String), 100)
  })
})
