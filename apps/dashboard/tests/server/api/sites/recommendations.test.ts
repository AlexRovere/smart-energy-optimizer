import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createError, type H3Event } from 'h3'
import handler from '../../../../server/api/sites/[id]/recommendations.get'

const { mockRequireSiteAccess, mockRecommendationsForSite, mockGetRouterParam } = vi.hoisted(() => {
  const mockRequireSiteAccess = vi.fn()
  const mockRecommendationsForSite = vi.fn()
  const mockGetRouterParam = vi.fn()
  return { mockRequireSiteAccess, mockRecommendationsForSite, mockGetRouterParam }
})

vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>()
  return {
    ...original,
    getRouterParam: mockGetRouterParam
  }
})

vi.mock('../../../../server/utils/guard', () => ({
  requireSiteAccess: mockRequireSiteAccess
}))

vi.mock('../../../../server/utils/recommendationsForSite', () => ({
  recommendationsForSite: mockRecommendationsForSite
}))

vi.mock('../../../../server/database', () => ({
  db: {}
}))

const accountFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }
const mockEvent = {} as H3Event

describe('GET /api/sites/[id]/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSiteAccess.mockImplementation(async (_event: unknown, id: string) => ({ account: accountFixture, siteId: id }))
  })

  it('rend les recommandations calculées pour un site autorisé', async () => {
    mockGetRouterParam.mockReturnValue('SITE001')
    const recommendationItem = { recommendation_id: 'REC-SITE001-conso-2026-09-18T10:00:00.000Z' }
    mockRecommendationsForSite.mockResolvedValue({ recommendations: [recommendationItem], unavailable: ['forecast'] })

    const result = await handler(mockEvent)

    expect(result).toEqual({ recommendations: [recommendationItem], unavailable: ['forecast'] })
    expect(mockRequireSiteAccess).toHaveBeenCalledWith(mockEvent, 'SITE001')
    expect(mockRecommendationsForSite).toHaveBeenCalledWith({}, 'SITE001', expect.any(Date))
  })

  it('retourne 403 sans calculer pour un site hors périmètre', async () => {
    mockGetRouterParam.mockReturnValue('SITE002')
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 403 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
    expect(mockRecommendationsForSite).not.toHaveBeenCalled()
  })

  it('retourne 404 sans calculer pour un site inconnu', async () => {
    mockGetRouterParam.mockReturnValue('SITE999')
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 404 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 404 })
    expect(mockRecommendationsForSite).not.toHaveBeenCalled()
  })

  it('retourne 503 si le calcul des recommandations échoue', async () => {
    mockGetRouterParam.mockReturnValue('SITE001')
    mockRecommendationsForSite.mockRejectedValue(new Error('indisponible'))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })
})
