import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/sites/[id]/recommendations.get'

const { mockRequireAccount, mockRecommendationsForSite, mockGetRouterParam } = vi.hoisted(() => {
  const mockRequireAccount = vi.fn()
  const mockRecommendationsForSite = vi.fn()
  const mockGetRouterParam = vi.fn()
  return { mockRequireAccount, mockRecommendationsForSite, mockGetRouterParam }
})

vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>()
  return {
    ...original,
    getRouterParam: mockGetRouterParam
  }
})

vi.mock('../../../../server/utils/guard', () => ({
  requireAccount: mockRequireAccount
}))

vi.mock('../../../../server/utils/recommendationsForSite', () => ({
  recommendationsForSite: mockRecommendationsForSite
}))

vi.mock('../../../../server/database', () => ({
  db: {}
}))

const compteFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }
const mockEvent = {} as H3Event

describe('GET /api/sites/[id]/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccount.mockResolvedValue(compteFixture)
  })

  it('rend les recommandations calculées pour le site', async () => {
    mockGetRouterParam.mockReturnValue('SITE001')
    const recommandation = { recommendation_id: 'REC-SITE001-conso-2026-09-18T10:00:00.000Z' }
    mockRecommendationsForSite.mockResolvedValue([recommandation])

    const résultat = await handler(mockEvent)

    expect(résultat).toEqual([recommandation])
    expect(mockRecommendationsForSite).toHaveBeenCalledWith({}, 'SITE001', expect.any(Date))
  })

  it('retourne 422 pour un identifiant de site invalide', async () => {
    mockGetRouterParam.mockReturnValue('pas-un-site')

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 401 quand requireAccount rejette', async () => {
    mockGetRouterParam.mockReturnValue('SITE001')
    mockRequireAccount.mockRejectedValue(Object.assign(new Error('Session invalide'), { statusCode: 401 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 503 si le calcul des recommandations échoue', async () => {
    mockGetRouterParam.mockReturnValue('SITE001')
    mockRecommendationsForSite.mockRejectedValue(new Error('indisponible'))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })
})
