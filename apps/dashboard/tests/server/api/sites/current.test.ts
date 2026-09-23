import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError, type H3Event } from 'h3'
import handler from '../../../../server/api/sites/[id]/current.get'

const { mockFetchMockApi, mockGetRouterParam, mockLoggerError, mockRequireSiteAccess } = vi.hoisted(() => ({
  mockFetchMockApi: vi.fn(),
  mockGetRouterParam: vi.fn(),
  mockLoggerError: vi.fn(),
  mockRequireSiteAccess: vi.fn(),
}))

vi.mock('../../../../server/utils/mockApiClient', () => ({
  fetchMockApi: mockFetchMockApi
}))

vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>()
  return { ...original, getRouterParam: mockGetRouterParam }
})


vi.mock('../../../../server/utils/guard', () => ({
  requireSiteAccess: mockRequireSiteAccess
}))

vi.mock('../../../../server/utils/logger', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}))

const mockEvent = {} as H3Event

const lectureValide = {
  timestamp: '2026-09-16T14:00:00Z',
  site_id: 'SITE001',
  site_type: 'office',
  consumption_kw: 87.34,
  consumption_kw_corrected: 87.34,
  consumption_kwh: 0,
  voltage_v: 230,
  current_a: 10,
  power_factor: 0.95,
  temperature_celsius: 21,
  humidity_percent: 45,
  null_reasons: [],
  data_quality: 'good'
}

describe('GET /api/sites/[id]/current', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSiteAccess.mockImplementation(async (_event: unknown, id: string) => ({ account: {}, siteId: id }))
  })

  it('retourne la lecture courante pour un site autorisé', async () => {
    mockGetRouterParam.mockReturnValue('SITE001')
    mockFetchMockApi.mockResolvedValue(lectureValide)

    const résultat = await handler(mockEvent)
    expect(résultat).toMatchObject({ site_id: 'SITE001', consumption_kw: 87.34 })
    expect(mockRequireSiteAccess).toHaveBeenCalledWith(mockEvent, 'SITE001')
  })

  it('retourne 403 sans interroger la source pour un site hors périmètre', async () => {
    mockGetRouterParam.mockReturnValue('SITE002')
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 403 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
    expect(mockFetchMockApi).not.toHaveBeenCalled()
  })

  it('retourne 404 sans interroger la source pour un site inconnu', async () => {
    mockGetRouterParam.mockReturnValue('SITE999')
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 404 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 404 })
    expect(mockFetchMockApi).not.toHaveBeenCalled()
  })

  it('retourne 503 si la source est indisponible', async () => {
    mockGetRouterParam.mockReturnValue('SITE001')
    mockFetchMockApi.mockRejectedValue(new Error('connexion refusée'))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('loggue l\'erreur source avant de lancer 503', async () => {
    const messageErreur = 'API Mock hors service'
    mockGetRouterParam.mockReturnValue('SITE001')
    mockFetchMockApi.mockRejectedValue(new Error(messageErreur))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })

    expect(mockLoggerError).toHaveBeenCalledOnce()
    const [, contexte] = mockLoggerError.mock.calls[0] as [string, Record<string, unknown>]
    expect(contexte.message).toBe(messageErreur)
    expect(contexte.siteId).toBe('SITE001')
  })

  it('retourne 422 sans loguer si la source renvoie une forme invalide', async () => {
    mockGetRouterParam.mockReturnValue('SITE001')
    mockFetchMockApi.mockResolvedValue({ inattendu: true })

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
    expect(mockLoggerError).not.toHaveBeenCalled()
  })
})
