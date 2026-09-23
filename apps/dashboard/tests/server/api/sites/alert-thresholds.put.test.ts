import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError, type H3Event } from 'h3'
import handler from '../../../../server/api/sites/[id]/alert-thresholds/[type].put'

const { mockRequireSiteAccess, mockGetRouterParam, mockReadValidatedBody, mockUpsertAlertThreshold } = vi.hoisted(() => ({
  mockRequireSiteAccess: vi.fn(),
  mockGetRouterParam: vi.fn(),
  mockReadValidatedBody: vi.fn(),
  mockUpsertAlertThreshold: vi.fn()
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireSiteAccess: mockRequireSiteAccess
}))

vi.mock('../../../../server/utils/alertThresholdsRepository', () => ({
  upsertAlertThreshold: mockUpsertAlertThreshold
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
  db: {}
}))

const compteFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }
const mockEvent = {} as H3Event

function routerParams(id: string, type: string) {
  mockGetRouterParam.mockImplementation((_event: unknown, name: string) => (name === 'id' ? id : type))
}

function compteAutorisé(compte: typeof compteFixture) {
  mockRequireSiteAccess.mockImplementation(async (_event: unknown, id: string) => ({ account: compte, siteId: id }))
}

function corpsValide() {
  mockReadValidatedBody.mockImplementation((_event: unknown, safeParse: (v: unknown) => unknown) =>
    safeParse({ duration: 8, threshold: 1.8 })
  )
}

describe('PUT /api/sites/[id]/alert-thresholds/[type]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    compteAutorisé(compteFixture)
  })

  it('enregistre la règle d\'un site autorisé et la renvoie en snake_case', async () => {
    routerParams('SITE001', 'pic')
    corpsValide()

    const résultat = await handler(mockEvent)

    expect(mockRequireSiteAccess).toHaveBeenCalledWith(mockEvent, 'SITE001')
    expect(mockUpsertAlertThreshold).toHaveBeenCalledWith({}, 'SITE001', 'pic', { duration: 8, threshold: 1.8 })
    expect(résultat).toEqual({ site_id: 'SITE001', type: 'pic', duration: 8, threshold: 1.8 })
  })

  it('retourne 403 sans rien écrire pour un site hors périmètre', async () => {
    routerParams('SITE002', 'pic')
    corpsValide()
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 403 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
    expect(mockUpsertAlertThreshold).not.toHaveBeenCalled()
  })

  it('retourne 404 sans rien écrire pour un site inconnu', async () => {
    routerParams('SITE999', 'pic')
    corpsValide()
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 404 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 404 })
    expect(mockUpsertAlertThreshold).not.toHaveBeenCalled()
  })

  it('retourne 422 pour un type de règle invalide', async () => {
    routerParams('SITE001', 'anomalie')
    corpsValide()

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 pour un corps invalide', async () => {
    routerParams('SITE001', 'pic')
    mockReadValidatedBody.mockImplementation((_event: unknown, safeParse: (v: unknown) => unknown) =>
      safeParse({ duration: -1, threshold: 1.8 })
    )

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 401 quand la garde rejette la session', async () => {
    routerParams('SITE001', 'pic')
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 401 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 403 pour un compte VIEWER, même sur un site de son périmètre', async () => {
    compteAutorisé({ ...compteFixture, role: 'VIEWER' })
    routerParams('SITE001', 'pic')
    corpsValide()

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
    expect(mockUpsertAlertThreshold).not.toHaveBeenCalled()
  })

  it('autorise un compte ADMIN', async () => {
    compteAutorisé({ ...compteFixture, role: 'ADMIN' })
    routerParams('SITE001', 'pic')
    corpsValide()

    await expect(handler(mockEvent)).resolves.toBeDefined()
  })
})
