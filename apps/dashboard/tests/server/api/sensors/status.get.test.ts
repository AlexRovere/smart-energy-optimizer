import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import { createError } from 'h3'
import handler from '../../../../server/api/sensors/status.get'

const { mockRequireAccount, mockAllowedSites, mockFetchMockApi, mockLoggerError } = vi.hoisted(() => ({
  mockRequireAccount: vi.fn(),
  mockAllowedSites: vi.fn(),
  mockFetchMockApi: vi.fn(),
  mockLoggerError: vi.fn(),
}))

vi.mock('../../../../server/utils/guard', () => ({ requireAccount: mockRequireAccount }))
vi.mock('../../../../server/utils/session', () => ({ allowedSites: mockAllowedSites }))
vi.mock('../../../../server/utils/mockApiClient', () => ({ fetchMockApi: mockFetchMockApi }))
vi.mock('../../../../server/utils/logger', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock('../../../../server/database', () => ({ db: {} }))

const mockEvent = { path: '/api/sensors/status' } as H3Event

function site(name: string, overall: string, humidity = 'ok') {
  const ok = { status: 'ok', failing_until: null }
  return {
    site_name: name,
    sensors: {
      consumption: ok,
      electrical: ok,
      temperature: ok,
      humidity: humidity === 'ok' ? ok : { status: humidity, failing_until: '2026-09-29T08:07:46.247148' },
      network: ok,
    },
    overall,
  }
}

const source = {
  SITE001: site('Bureau Paris La Défense', 'ok'),
  SITE002: site('Usine Lyon Vénissieux', 'degraded', 'failing'),
  SITE003: site('Data Center Marseille', 'ok'),
}

describe('GET /api/sensors/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccount.mockResolvedValue({ id: 'u', email: 'a@b.fr', role: 'VIEWER' })
  })

  it("relaie l'état des capteurs des seuls sites autorisés", async () => {
    mockAllowedSites.mockResolvedValue(['SITE001', 'SITE002'])
    mockFetchMockApi.mockResolvedValue(source)

    const result = await handler(mockEvent)

    expect(mockFetchMockApi).toHaveBeenCalledWith('/api/v1/sensors/status')
    expect(Object.keys(result)).toEqual(['SITE001', 'SITE002'])
    expect(result.SITE002).toEqual(source.SITE002)
  })

  it('accepte un état inconnu de la source sans le rejeter', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockFetchMockApi.mockResolvedValue({ SITE001: site('Bureau', 'unknown', 'rebooting') })

    const result = await handler(mockEvent)

    expect(result.SITE001?.overall).toBe('unknown')
  })

  it('rend 401 sans session', async () => {
    mockRequireAccount.mockRejectedValue(Object.assign(new Error('Session invalide'), { statusCode: 401 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rend 503 et journalise quand la source ne répond pas', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockFetchMockApi.mockRejectedValue(createError({ status: 503 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
    expect(mockLoggerError).toHaveBeenCalledOnce()
  })

  it('rend 502 sur une réponse de forme inattendue', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockFetchMockApi.mockResolvedValue([{ wrong: 'la bonne forme' }])

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 502 })
  })
})
