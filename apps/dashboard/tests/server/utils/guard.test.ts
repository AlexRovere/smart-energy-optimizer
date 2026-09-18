import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import { requireRole } from '../../../server/utils/guard'

const { mockAccountForSession } = vi.hoisted(() => ({
  mockAccountForSession: vi.fn()
}))

vi.mock('../../../server/utils/session', () => ({
  accountForSession: mockAccountForSession
}))

vi.mock('../../../server/database', () => ({ db: {} }))

// getUserSession et clearUserSession sont des auto-imports Nuxt dans guard.ts.
// Dans l'environnement de test @nuxt/test-utils, ces fonctions sont exposées
// en tant que globaux et peuvent être substituées par vi.stubGlobal.
const mockGetUserSession = vi.fn()
const mockClearUserSession = vi.fn()
vi.stubGlobal('getUserSession', mockGetUserSession)
vi.stubGlobal('clearUserSession', mockClearUserSession)

const mockEvent = {} as H3Event

describe('requireRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('résout avec le compte si le rôle correspond', async () => {
    const compte = { id: 'uuid-admin', email: 'admin@enervision.local', role: 'ADMIN' }
    mockGetUserSession.mockResolvedValue({ sessionId: 'session-123' })
    mockAccountForSession.mockResolvedValue(compte)

    await expect(requireRole(mockEvent, 'ADMIN')).resolves.toEqual(compte)
  })

  it('rejette avec 403 si le rôle ne correspond pas', async () => {
    mockGetUserSession.mockResolvedValue({ sessionId: 'session-456' })
    mockAccountForSession.mockResolvedValue({
      id: 'uuid-op', email: 'operator@enervision.local', role: 'OPERATOR'
    })

    await expect(requireRole(mockEvent, 'ADMIN')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejette avec 401 si aucun sessionId dans le cookie', async () => {
    mockGetUserSession.mockResolvedValue({})

    await expect(requireRole(mockEvent, 'ADMIN')).rejects.toMatchObject({ statusCode: 401 })
  })
})
