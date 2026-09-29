import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/admin/users/[id].delete'

const VALID_UUID = 'a1b2c3d4-e5f6-4789-abcd-ef1234567890'

const { mockRequireRole, mockGetRouterParam, mockDbDelete } = vi.hoisted(() => {
  const mockDbDelete = vi.fn()
  return {
    mockRequireRole: vi.fn(),
    mockGetRouterParam: vi.fn(),
    mockDbDelete
  }
})

vi.mock('../../../../server/utils/guard', () => ({
  requireRole: mockRequireRole
}))

vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>()
  return { ...original, getRouterParam: mockGetRouterParam }
})

vi.mock('../../../../server/database', () => ({
  db: { delete: mockDbDelete }
}))

const mockEvent = {} as H3Event

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue({ id: 'uuid-admin', email: 'admin@enervision.local', role: 'ADMIN' })
    mockGetRouterParam.mockReturnValue(VALID_UUID)
  })

  it('retourne 401 si la session est absente', async () => {
    mockRequireRole.mockRejectedValue({ statusCode: 401, message: 'Session invalide' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 403 pour un compte non-ADMIN', async () => {
    mockRequireRole.mockRejectedValue({ statusCode: 403, message: 'Accès interdit' })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('retourne 422 si l\'identifiant n\'est pas un UUID', async () => {
    mockGetRouterParam.mockReturnValue('pas-un-uuid')
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 404 si le compte n\'existe pas', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([])
      })
    })
    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('retourne { success: true } pour un compte existant', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: VALID_UUID }])
      })
    })
    const result = await handler(mockEvent)
    expect(result).toEqual({ success: true })
  })
})
