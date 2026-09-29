import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../server/api/stats/summary.get'
import { createError } from 'h3'

const { mockFetchMockApi, mockLoggerError, mockRequireAccount, mockAllowedSites } = vi.hoisted(() => ({
  mockFetchMockApi: vi.fn(),
  mockLoggerError: vi.fn(),
  mockRequireAccount: vi.fn(),
  mockAllowedSites: vi.fn()
}))

vi.mock('../../../../server/utils/mockApiClient', () => ({
  fetchMockApi: mockFetchMockApi
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireAccount: mockRequireAccount
}))

vi.mock('../../../../server/utils/session', () => ({
  allowedSites: mockAllowedSites
}))

vi.mock('../../../../server/database', () => ({ db: {} }))

vi.mock('../../../../server/utils/logger', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}))

const accountFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }

function site(id: string, consumption: number | null, capacity: number) {
  return {
    site_id: id,
    site_name: `Site ${id}`,
    current_consumption_kw: consumption,
    capacity_kw: capacity,
    load_percent: consumption === null ? null : Math.round((consumption / capacity) * 1000) / 10,
    data_quality: consumption === null ? 'critical' as const : 'good' as const
  }
}

// Quatre sites au parc : SITE003 est sans mesure et listé, SITE004 est exclu
// sans figurer dans `sites`. Les deux formes doivent être comptées.
const parkSummary = {
  timestamp: '2026-09-16T14:32:00Z',
  total_sites: 4,
  excluded_sites: ['SITE003', 'SITE004'],
  total_consumption_kw: 400,
  total_capacity_kw: 600,
  average_load_percent: 66.7,
  sites: [site('SITE001', 100, 200), site('SITE002', 300, 400), site('SITE003', null, 500)]
}

const mockEvent = {} as Parameters<typeof handler>[0]

describe('GET /api/stats/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccount.mockResolvedValue(accountFixture)
    mockAllowedSites.mockResolvedValue(['SITE001', 'SITE002', 'SITE003', 'SITE004'])
  })

  it('rend la synthèse du parc entier quand tout le parc est autorisé', async () => {
    mockFetchMockApi.mockResolvedValue(parkSummary)

    const result = await handler(mockEvent)

    expect(result).toMatchObject({
      timestamp: '2026-09-16T14:32:00Z',
      total_sites: 4,
      excluded_sites: ['SITE003', 'SITE004'],
      total_consumption_kw: 400,
      total_capacity_kw: 600,
      average_load_percent: 66.7
    })
    expect(result.sites).toHaveLength(3)
    expect(mockAllowedSites).toHaveBeenCalledWith({}, accountFixture)
  })

  it('ne rend que les sites du périmètre du compte', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001', 'SITE003'])
    mockFetchMockApi.mockResolvedValue(parkSummary)

    const result = await handler(mockEvent)

    expect(result.sites.map(s => s.site_id)).toEqual(['SITE001', 'SITE003'])
    expect(result.excluded_sites).toEqual(['SITE003'])
  })

  it('recalcule totaux et moyenne sur le seul périmètre, sans les sites exclus', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001', 'SITE003'])
    mockFetchMockApi.mockResolvedValue(parkSummary)

    const result = await handler(mockEvent)

    expect(result).toMatchObject({
      total_sites: 2,
      total_consumption_kw: 100,
      total_capacity_kw: 200,
      average_load_percent: 50
    })
  })

  it('nomme comme exclu un site sans mesure que la source n\'a pas nommé', async () => {
    mockFetchMockApi.mockResolvedValue({
      ...parkSummary,
      excluded_sites: [],
      sites: [site('SITE001', 100, 200), site('SITE003', null, 500)]
    })

    const result = await handler(mockEvent)

    expect(result).toMatchObject({
      total_sites: 2,
      excluded_sites: ['SITE003'],
      total_consumption_kw: 100,
      total_capacity_kw: 200
    })
  })

  it('rend une synthèse vide, sans total inventé, pour un compte sans site', async () => {
    mockAllowedSites.mockResolvedValue([])
    mockFetchMockApi.mockResolvedValue(parkSummary)

    const result = await handler(mockEvent)

    expect(result).toMatchObject({
      total_sites: 0,
      excluded_sites: [],
      total_consumption_kw: null,
      total_capacity_kw: 0,
      average_load_percent: null,
      sites: []
    })
  })

  it('inclut excluded_sites dans la réponse même si la source l\'omet', async () => {
    const { excluded_sites: _omitted, ...withoutExcluded } = parkSummary
    mockFetchMockApi.mockResolvedValue({ ...withoutExcluded, sites: [site('SITE001', 100, 200)] })

    const result = await handler(mockEvent)

    expect(result.excluded_sites).toEqual([])
  })

  it('lève une erreur 502 si la source renvoie une forme inattendue', async () => {
    mockFetchMockApi.mockResolvedValue({ unexpected: true })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 502 })
  })

  it('lève une erreur 503 si la source est indisponible', async () => {
    mockFetchMockApi.mockRejectedValue(createError({ status: 503 }))
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('loggue l\'erreur source avant de lancer 503', async () => {
    const errorMessage = 'API Mock injoignable'
    mockFetchMockApi.mockRejectedValue(new Error(errorMessage))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })

    expect(mockLoggerError).toHaveBeenCalledOnce()
    const [, context] = mockLoggerError.mock.calls[0] as [string, Record<string, unknown>]
    expect(context.message).toBe(errorMessage)
  })
})
