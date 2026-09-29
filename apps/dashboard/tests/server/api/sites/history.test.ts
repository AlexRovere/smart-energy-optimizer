import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError, type H3Event } from 'h3'
import handler from '../../../../server/api/sites/[id]/history.get'

const { mockQuerySiteHistory, mockGetQuery, mockGetRouterParam, mockLoggerError, mockRequireSiteAccess } = vi.hoisted(() => {
  const mockQuerySiteHistory = vi.fn()
  const mockGetQuery = vi.fn()
  const mockGetRouterParam = vi.fn()
  const mockLoggerError = vi.fn()
  const mockRequireSiteAccess = vi.fn()
  return { mockQuerySiteHistory, mockGetQuery, mockGetRouterParam, mockLoggerError, mockRequireSiteAccess }
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

vi.mock('../../../../server/utils/guard', () => ({
  requireSiteAccess: mockRequireSiteAccess
}))

vi.mock('../../../../server/utils/logger', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}))


const mockEvent = {} as H3Event

function configureEvent(siteId: string, params: Record<string, string>) {
  mockGetRouterParam.mockReturnValue(siteId)
  mockGetQuery.mockReturnValue(params)
}

const readingFixture = {
  timestamp: '2026-09-16T14:00:00Z',
  site_id: 'SITE001',
  consumption_kw: 87.34,
  null_reasons: [],
  data_quality: 'good'
}

describe('GET /api/sites/[id]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSiteAccess.mockImplementation(async (_event: unknown, id: string) => ({ account: {}, siteId: id }))
  })

  it('retourne les mesures pour un site autorisé et une période valide', async () => {
    mockQuerySiteHistory.mockResolvedValue([readingFixture])
    configureEvent('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z'
    })
    const result = await handler(mockEvent)
    expect(result).toHaveLength(1)
    expect(mockRequireSiteAccess).toHaveBeenCalledWith(mockEvent, 'SITE001')
    expect(mockQuerySiteHistory).toHaveBeenCalledWith('SITE001', '2026-09-16T00:00:00Z', '2026-09-17T00:00:00Z', 24)
  })

  it('retourne 403 sans lire l\'historique pour un site hors périmètre', async () => {
    configureEvent('SITE002', { from: '2026-09-16T00:00:00Z', to: '2026-09-17T00:00:00Z' })
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 403 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
    expect(mockQuerySiteHistory).not.toHaveBeenCalled()
  })

  it('retourne 404 sans lire l\'historique pour un site inconnu', async () => {
    configureEvent('SITE999', { from: '2026-09-16T00:00:00Z', to: '2026-09-17T00:00:00Z' })
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 404 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 404 })
    expect(mockQuerySiteHistory).not.toHaveBeenCalled()
  })

  it('retourne un tableau vide si aucune mesure sur la période', async () => {
    mockQuerySiteHistory.mockResolvedValue([])
    configureEvent('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z'
    })
    const result = await handler(mockEvent)
    expect(result).toEqual([])
  })

  it('retourne 422 si from est absent', async () => {
    configureEvent('SITE001', { to: '2026-09-17T00:00:00Z' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 si to est absent', async () => {
    configureEvent('SITE001', { from: '2026-09-16T00:00:00Z' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 si from est mal formé', async () => {
    configureEvent('SITE001', {
      from: '16/09/2026',
      to: '2026-09-17T00:00:00Z'
    })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 si limit est hors domaine', async () => {
    configureEvent('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z',
      limit: '5000'
    })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 503 si le répertoire Parquet est indisponible', async () => {
    mockQuerySiteHistory.mockRejectedValue(new Error("NUXT_PARQUET_DIR n'est pas défini"))
    configureEvent('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z'
    })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('loggue l\'erreur DuckDB avant de lancer 503', async () => {
    const errorMessage = 'DuckDB: impossible de lire le fichier Parquet'
    mockQuerySiteHistory.mockRejectedValue(new Error(errorMessage))
    configureEvent('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z'
    })

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })

    expect(mockLoggerError).toHaveBeenCalledOnce()
    const [, context] = mockLoggerError.mock.calls[0] as [string, Record<string, unknown>]
    expect(context.message).toBe(errorMessage)
    expect(context.siteId).toBe('SITE001')
  })

  it('applique la limite personnalisée', async () => {
    mockQuerySiteHistory.mockResolvedValue([])
    configureEvent('SITE001', {
      from: '2026-09-16T00:00:00Z',
      to: '2026-09-17T00:00:00Z',
      limit: '100'
    })
    await handler(mockEvent)
    expect(mockQuerySiteHistory).toHaveBeenCalledWith('SITE001', expect.any(String), expect.any(String), 100)
  })

  describe('bornes de la plage (#46)', () => {
    it('prend par défaut un point par heure de la plage, pour ne rien tronquer', async () => {
      mockQuerySiteHistory.mockResolvedValue([])
      configureEvent('SITE001', { from: '2026-06-01T00:00:00Z', to: '2026-09-01T00:00:00Z' })

      await handler(mockEvent)

      expect(mockQuerySiteHistory).toHaveBeenCalledWith('SITE001', '2026-06-01T00:00:00Z', '2026-09-01T00:00:00Z', 2208)
    })

    it('refuse une fin qui ne suit pas le début', async () => {
      configureEvent('SITE001', { from: '2026-09-17T00:00:00Z', to: '2026-09-16T00:00:00Z' })

      await expect(handler(mockEvent)).rejects.toMatchObject({
        statusCode: 422,
        statusMessage: 'La fin de la plage doit suivre son début',
      })
      expect(mockQuerySiteHistory).not.toHaveBeenCalled()
    })

    it('refuse une plage de plus de 92 jours', async () => {
      configureEvent('SITE001', { from: '2026-06-01T00:00:00Z', to: '2026-09-02T00:00:00Z' })

      await expect(handler(mockEvent)).rejects.toMatchObject({
        statusCode: 422,
        statusMessage: 'Plage trop longue : 92 jours au plus',
      })
      expect(mockQuerySiteHistory).not.toHaveBeenCalled()
    })
  })
})
