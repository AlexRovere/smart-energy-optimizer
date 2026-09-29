import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import { requireRole, requireSiteAccess } from '../../../server/utils/guard'

const { mockAccountForSession, mockAllowedSites, mockSiteExists } = vi.hoisted(() => ({
  mockAccountForSession: vi.fn(),
  mockAllowedSites: vi.fn(),
  mockSiteExists: vi.fn()
}))

vi.mock('../../../server/utils/session', () => ({
  accountForSession: mockAccountForSession,
  allowedSites: mockAllowedSites
}))

vi.mock('../../../server/utils/sitesRepository', () => ({
  siteExists: mockSiteExists
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
    const account = { id: 'uuid-admin', email: 'admin@enervision.local', role: 'ADMIN' }
    mockGetUserSession.mockResolvedValue({ sessionId: 'session-123' })
    mockAccountForSession.mockResolvedValue(account)

    await expect(requireRole(mockEvent, 'ADMIN')).resolves.toEqual(account)
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

describe('requireSiteAccess', () => {
  const operator = { id: 'uuid-op', email: 'operator@enervision.local', role: 'OPERATOR' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue({ sessionId: 'session-789' })
    mockAccountForSession.mockResolvedValue(operator)
    mockSiteExists.mockResolvedValue(true)
    mockAllowedSites.mockResolvedValue(['SITE001'])
  })

  it('rend le compte et le site quand le site est dans le périmètre', async () => {
    await expect(requireSiteAccess(mockEvent, 'SITE001'))
      .resolves.toEqual({ account: operator, siteId: 'SITE001' })
  })

  it('rejette avec 401 avant tout contrôle du site si la session est invalide', async () => {
    mockGetUserSession.mockResolvedValue({})

    await expect(requireSiteAccess(mockEvent, 'INVALIDE')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejette avec 422 si le format de l\'identifiant est invalide', async () => {
    await expect(requireSiteAccess(mockEvent, 'INVALIDE')).rejects.toMatchObject({ statusCode: 422 })
    expect(mockSiteExists).not.toHaveBeenCalled()
  })

  it('rejette avec 422 si l\'identifiant est absent', async () => {
    await expect(requireSiteAccess(mockEvent, undefined)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('rejette avec 404 si le site n\'existe pas en base', async () => {
    mockSiteExists.mockResolvedValue(false)

    await expect(requireSiteAccess(mockEvent, 'SITE999')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejette avec 403 si le site existe hors du périmètre du compte', async () => {
    await expect(requireSiteAccess(mockEvent, 'SITE002')).rejects.toMatchObject({ statusCode: 403 })
  })
})
