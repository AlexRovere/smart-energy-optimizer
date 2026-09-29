import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/alerts/index.get'
import { createError } from 'h3'

const { mockRequireAccount, mockAllowedSites, mockFetchMockApi, mockLoggerError } = vi.hoisted(() => ({
  mockRequireAccount: vi.fn(),
  mockAllowedSites: vi.fn(),
  mockFetchMockApi: vi.fn(),
  mockLoggerError: vi.fn(),
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireAccount: mockRequireAccount,
}))

vi.mock('../../../../server/utils/session', () => ({
  allowedSites: mockAllowedSites,
}))

vi.mock('../../../../server/utils/mockApiClient', () => ({
  fetchMockApi: mockFetchMockApi,
}))

vi.mock('../../../../server/utils/logger', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../../server/database', () => ({ db: {} }))

const accountFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }
const mockEvent = { path: '/api/alerts' } as H3Event

const alertsFixture = [
  { alert_id: 'ALT-001', site_id: 'SITE001', severity: 'critical', type: 'outage',    message: 'Capteur muet', timestamp: '2026-09-22T10:00:00Z' },
  { alert_id: 'ALT-002', site_id: 'SITE002', severity: 'high',     type: 'threshold', message: 'Seuil dépassé',  timestamp: '2026-09-22T09:00:00Z', value: 781, threshold: 720 },
  { alert_id: 'ALT-003', site_id: 'SITE003', severity: 'medium',   type: 'spike',     message: 'Pic détecté',   timestamp: '2026-09-22T08:00:00Z' },
]

describe('GET /api/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccount.mockResolvedValue(accountFixture)
  })

  it('rend les alertes filtrées par les sites autorisés', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001', 'SITE002'])
    mockFetchMockApi.mockResolvedValue(alertsFixture)

    const result = await handler(mockEvent)

    expect(result).toHaveLength(2)
    expect((result as typeof alertsFixture)[0]?.alert_id).toBe('ALT-001')
    expect((result as typeof alertsFixture)[1]?.alert_id).toBe('ALT-002')
  })

  it('exclut les alertes de sites hors périmètre', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockFetchMockApi.mockResolvedValue(alertsFixture)

    const result = await handler(mockEvent) as typeof alertsFixture
    expect(result.every(a => a.site_id === 'SITE001')).toBe(true)
  })

  it('retourne un tableau vide quand aucun site n\'est autorisé', async () => {
    mockAllowedSites.mockResolvedValue([])
    mockFetchMockApi.mockResolvedValue(alertsFixture)

    expect(await handler(mockEvent)).toEqual([])
  })

  it('retourne 401 quand requireAccount rejette', async () => {
    mockRequireAccount.mockRejectedValue(Object.assign(new Error('Session invalide'), { statusCode: 401 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 503 et logue quand fetchMockApi rejette', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockFetchMockApi.mockRejectedValue(createError({ status: 503 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
    expect(mockLoggerError).toHaveBeenCalledOnce()
  })

  it('retourne 502 si la réponse n\'est pas un tableau d\'objets valides', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockFetchMockApi.mockResolvedValue({ unexpected: true })

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 502 })
  })

  it('passe à travers une alerte dont la sévérité est inconnue', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockFetchMockApi.mockResolvedValue([
      { alert_id: 'ALT-X', site_id: 'SITE001', severity: 'unknown_severity', type: 'anomaly', message: 'Test', timestamp: '2026-09-22T10:00:00Z' },
    ])

    const result = await handler(mockEvent) as Array<{ severity: string }>
    expect(result).toHaveLength(1)
    expect(result[0]?.severity).toBe('unknown_severity')
  })
})
