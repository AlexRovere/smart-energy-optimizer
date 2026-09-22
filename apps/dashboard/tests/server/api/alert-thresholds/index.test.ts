import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/alert-thresholds/index.get'

const { mockRequireAccount, mockAllowedSites, mockListAlertThresholds } = vi.hoisted(() => ({
  mockRequireAccount: vi.fn(),
  mockAllowedSites: vi.fn(),
  mockListAlertThresholds: vi.fn()
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireAccount: mockRequireAccount
}))

vi.mock('../../../../server/utils/session', () => ({
  allowedSites: mockAllowedSites
}))

vi.mock('../../../../server/utils/alertThresholdsRepository', () => ({
  listAlertThresholds: mockListAlertThresholds
}))

vi.mock('../../../../server/database', () => ({
  db: {}
}))

const compteFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }
const mockEvent = {} as H3Event

describe('GET /api/alert-thresholds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccount.mockResolvedValue(compteFixture)
  })

  it('rend les règles des sites autorisés, en snake_case', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockListAlertThresholds.mockResolvedValue([
      { siteId: 'SITE001', type: 'conso', duration: 5, threshold: 200 },
      { siteId: 'SITE001', type: 'pic', duration: 5, threshold: 1.5 }
    ])

    const résultat = await handler(mockEvent)

    expect(résultat).toEqual([
      { site_id: 'SITE001', type: 'conso', duration: 5, threshold: 200 },
      { site_id: 'SITE001', type: 'pic', duration: 5, threshold: 1.5 }
    ])
    expect(mockAllowedSites).toHaveBeenCalledWith({}, compteFixture)
    expect(mockListAlertThresholds).toHaveBeenCalledWith({}, ['SITE001'])
  })

  it('retourne un tableau vide si l\'utilisateur n\'a aucun site autorisé', async () => {
    mockAllowedSites.mockResolvedValue([])
    mockListAlertThresholds.mockResolvedValue([])

    expect(await handler(mockEvent)).toEqual([])
  })

  it('retourne 401 quand requireAccount rejette', async () => {
    mockRequireAccount.mockRejectedValue(Object.assign(new Error('Session invalide'), { statusCode: 401 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 503 si la lecture des règles échoue', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockListAlertThresholds.mockRejectedValue(new Error('DB indisponible'))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })
})
