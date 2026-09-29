import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError, type H3Event } from 'h3'
import putHandler from '../../../../server/api/sites/[id]/feedback.put'
import getHandler from '../../../../server/api/sites/[id]/feedback.get'

const { mockRequireSiteAccess, mockGetRouterParam, mockReadBody, mockUpsertFeedback, mockListFeedback } = vi.hoisted(() => ({
  mockRequireSiteAccess: vi.fn(),
  mockGetRouterParam: vi.fn(),
  mockReadBody: vi.fn(),
  mockUpsertFeedback: vi.fn(),
  mockListFeedback: vi.fn(),
}))

vi.mock('../../../../server/utils/guard', () => ({ requireSiteAccess: mockRequireSiteAccess }))
vi.mock('../../../../server/utils/feedbackRepository', () => ({
  upsertFeedback: mockUpsertFeedback,
  listFeedback: mockListFeedback,
}))
vi.mock('../../../../server/database', () => ({ db: {} }))
vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>()
  return {
    ...original,
    getRouterParam: mockGetRouterParam,
    readValidatedBody: async (_event: unknown, validate: (body: unknown) => unknown) => validate(await mockReadBody()),
  }
})

const viewer = { id: 'user-uuid', email: 'lecteur@enervision.fr', role: 'VIEWER' }
const event = {} as H3Event

describe('PUT /api/sites/{id}/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRouterParam.mockReturnValue('SITE001')
    mockRequireSiteAccess.mockResolvedValue({ account: viewer, siteId: 'SITE001' })
  })

  it("enregistre le vote de n'importe quel rôle ayant accès au site", async () => {
    mockReadBody.mockResolvedValue({ target_type: 'recommendation', target_id: 'REC-1', useful: true })

    const result = await putHandler(event)

    expect(mockUpsertFeedback).toHaveBeenCalledWith({}, {
      userId: 'user-uuid', siteId: 'SITE001', targetType: 'recommendation', targetId: 'REC-1', useful: true,
    })
    expect(result).toEqual({ target_type: 'recommendation', target_id: 'REC-1', useful: true })
  })

  it.each([
    ['un type de cible inconnu', { target_type: 'alert', target_id: 'X', useful: true }],
    ['une cible vide', { target_type: 'forecast', target_id: '', useful: true }],
    ['un vote qui n’est pas un booléen', { target_type: 'forecast', target_id: 'P-1', useful: 'oui' }],
  ])('refuse %s en 422', async (_case, body) => {
    mockReadBody.mockResolvedValue(body)

    await expect(putHandler(event)).rejects.toMatchObject({ statusCode: 422 })
    expect(mockUpsertFeedback).not.toHaveBeenCalled()
  })

  it('refuse un site hors périmètre sans rien écrire', async () => {
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 403 }))

    await expect(putHandler(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(mockUpsertFeedback).not.toHaveBeenCalled()
  })
})

describe('GET /api/sites/{id}/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRouterParam.mockReturnValue('SITE001')
    mockRequireSiteAccess.mockResolvedValue({ account: viewer, siteId: 'SITE001' })
  })

  it('rend les votes du compte sur ce site, en snake_case', async () => {
    mockListFeedback.mockResolvedValue([{ targetType: 'forecast', targetId: 'P-1', useful: false }])

    expect(await getHandler(event)).toEqual([{ target_type: 'forecast', target_id: 'P-1', useful: false }])
    expect(mockListFeedback).toHaveBeenCalledWith({}, 'user-uuid', 'SITE001')
  })
})
