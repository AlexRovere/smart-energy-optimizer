import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/sites/index.get'

const { mockRequireAccount, mockAllowedSites, mockQuerySitesList } = vi.hoisted(() => {
  const mockRequireAccount = vi.fn()
  const mockAllowedSites = vi.fn()
  const mockQuerySitesList = vi.fn()
  return { mockRequireAccount, mockAllowedSites, mockQuerySitesList }
})

vi.mock('../../../../server/utils/guard', () => ({
  requireAccount: mockRequireAccount
}))

vi.mock('../../../../server/utils/session', () => ({
  allowedSites: mockAllowedSites
}))

vi.mock('../../../../server/utils/sitesRepository', () => ({
  querySitesList: mockQuerySitesList
}))

vi.mock('../../../../server/database', () => ({
  db: {}
}))

const mockEvent = {} as H3Event

const compteFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }

const siteFixture = {
  site_id: 'SITE001',
  site_name: 'Bureau Paris La Défense',
  site_type: 'office',
  location: 'Paris, France',
  capacity_kw: 300,
  status: 'active' as const,
  warning_threshold_kw: 240,
  present_in_source: true
}

describe('GET /api/sites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccount.mockResolvedValue(compteFixture)
  })

  it('retourne les sites autorisés de l\'utilisateur', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockQuerySitesList.mockResolvedValue([siteFixture])

    const résultat = await handler(mockEvent)

    expect(résultat).toEqual([siteFixture])
    expect(mockAllowedSites).toHaveBeenCalledWith({}, compteFixture)
    expect(mockQuerySitesList).toHaveBeenCalledWith({}, ['SITE001'])
  })

  it('retourne un tableau vide si l\'utilisateur n\'a aucun site autorisé', async () => {
    mockAllowedSites.mockResolvedValue([])
    mockQuerySitesList.mockResolvedValue([])

    const résultat = await handler(mockEvent)

    expect(résultat).toEqual([])
  })

  it('retourne 401 quand requireAccount rejette', async () => {
    mockRequireAccount.mockRejectedValue(
      Object.assign(new Error('Session invalide'), { statusCode: 401 })
    )

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 503 si querySitesList rejette', async () => {
    mockAllowedSites.mockResolvedValue(['SITE001'])
    mockQuerySitesList.mockRejectedValue(new Error('DB indisponible'))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })
})
