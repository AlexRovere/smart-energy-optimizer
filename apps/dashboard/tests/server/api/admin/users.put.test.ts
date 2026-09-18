import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/admin/users/[id].put'

const { mockRequireRole, mockGetRouterParam, mockReadValidatedBody, mockAllowedSites } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockGetRouterParam: vi.fn(),
  mockReadValidatedBody: vi.fn(),
  mockAllowedSites: vi.fn()
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireRole: mockRequireRole
}))

vi.mock('../../../../server/utils/session', () => ({
  allowedSites: mockAllowedSites
}))

vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>()
  return {
    ...original,
    getRouterParam: mockGetRouterParam,
    readValidatedBody: mockReadValidatedBody
  }
})

vi.mock('../../../../server/database', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      })
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      })
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([])
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([])
    })
  }
}))

const mockEvent = {} as H3Event

describe('PUT /api/admin/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 si la session est absente', async () => {
    mockRequireRole.mockRejectedValue({ statusCode: 401, message: 'Session invalide' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 403 pour un compte non-ADMIN', async () => {
    mockRequireRole.mockRejectedValue({ statusCode: 403, message: 'Accès interdit' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('retourne 422 si l\'identifiant n\'est pas un UUID', async () => {
    mockRequireRole.mockResolvedValue({ id: 'uuid-admin', email: 'admin@enervision.local', role: 'ADMIN' })
    mockGetRouterParam.mockReturnValue('pas-un-uuid')
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 404 si le compte n\'existe pas', async () => {
    mockRequireRole.mockResolvedValue({ id: 'uuid-admin', email: 'admin@enervision.local', role: 'ADMIN' })
    mockGetRouterParam.mockReturnValue('00000000-0000-0000-0000-000000000000')
    mockReadValidatedBody.mockImplementation((_event: unknown, safeParse: (v: unknown) => unknown) =>
      safeParse({ is_active: false })
    )
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 404 })
  })
})
