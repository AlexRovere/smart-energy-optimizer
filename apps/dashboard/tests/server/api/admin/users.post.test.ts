import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/admin/users/index.post'

const { mockRequireRole, mockReadValidatedBody } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockReadValidatedBody: vi.fn()
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireRole: mockRequireRole
}))

vi.mock('../../../../server/utils/session', () => ({
  allowedSites: vi.fn().mockResolvedValue([])
}))

vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>()
  return { ...original, readValidatedBody: mockReadValidatedBody }
})

vi.mock('../../../../server/database', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 1, name: 'ADMIN' }])
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'new-uuid', email: 'nouveau@enervision.local', isActive: true, createdAt: new Date()
        }])
      })
    })
  }
}))

vi.mock('@node-rs/argon2', () => ({
  hash: vi.fn().mockResolvedValue('$argon2id$digest')
}))

const mockEvent = {} as H3Event

describe('POST /api/admin/users', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 si la session est absente', async () => {
    mockRequireRole.mockRejectedValue({ statusCode: 401, message: 'Session invalide' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 403 pour un compte non-ADMIN', async () => {
    mockRequireRole.mockRejectedValue({ statusCode: 403, message: 'Accès interdit' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('retourne 422 si le body est invalide', async () => {
    mockRequireRole.mockResolvedValue({ id: 'uuid-admin', email: 'admin@enervision.local', role: 'ADMIN' })
    mockReadValidatedBody.mockImplementation((_event: unknown, safeParse: (v: unknown) => { success: boolean }) =>
      safeParse({ email: 'invalide', password: 'court', role: 'INCONNU', sites: [] })
    )
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })
})
