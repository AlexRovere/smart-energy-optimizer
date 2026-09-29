import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/admin/users/index.get'

const { mockRequireRole, mockAllowedSites } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockAllowedSites: vi.fn()
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireRole: mockRequireRole
}))

vi.mock('../../../../server/utils/session', () => ({
  allowedSites: mockAllowedSites
}))

vi.mock('../../../../server/database', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([])
        })
      })
    })
  }
}))

const mockEvent = {} as H3Event

describe('GET /api/admin/users', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne 401 si la session est absente', async () => {
    mockRequireRole.mockRejectedValue({ statusCode: 401, message: 'Session invalide' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 403 pour un compte non-ADMIN', async () => {
    mockRequireRole.mockRejectedValue({ statusCode: 403, message: 'Accès interdit' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('retourne un tableau pour un ADMIN', async () => {
    mockRequireRole.mockResolvedValue({ id: 'uuid-admin', email: 'admin@enervision.local', role: 'ADMIN' })
    mockAllowedSites.mockResolvedValue([])
    const result = await handler(mockEvent)
    expect(Array.isArray(result)).toBe(true)
  })
})
