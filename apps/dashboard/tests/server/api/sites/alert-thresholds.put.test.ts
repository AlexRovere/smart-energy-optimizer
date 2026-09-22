import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/sites/[id]/alert-thresholds/[type].put'

const { mockRequireAccount, mockGetRouterParam, mockReadValidatedBody, mockUpsertAlertThreshold } = vi.hoisted(() => ({
  mockRequireAccount: vi.fn(),
  mockGetRouterParam: vi.fn(),
  mockReadValidatedBody: vi.fn(),
  mockUpsertAlertThreshold: vi.fn()
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireAccount: mockRequireAccount
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

describe('PUT /api/sites/[id]/alert-thresholds/[type]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccount.mockResolvedValue(compteFixture)
  })

  it('enregistre la règle et la renvoie en snake_case', async () => {
    routerParams('SITE001', 'pic')
    mockReadValidatedBody.mockImplementation((_event: unknown, safeParse: (v: unknown) => unknown) =>
      safeParse({ duration: 8, threshold: 1.8 })
    )

    const résultat = await handler(mockEvent)

    expect(mockUpsertAlertThreshold).toHaveBeenCalledWith({}, 'SITE001', 'pic', { duration: 8, threshold: 1.8 })
    expect(résultat).toEqual({ site_id: 'SITE001', type: 'pic', duration: 8, threshold: 1.8 })
  })

  it('retourne 422 pour un identifiant de site invalide', async () => {
    routerParams('pas-un-site', 'pic')
    mockReadValidatedBody.mockImplementation((_event: unknown, safeParse: (v: unknown) => unknown) =>
      safeParse({ duration: 8, threshold: 1.8 })
    )

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 pour un type de règle invalide', async () => {
    routerParams('SITE001', 'anomalie')
    mockReadValidatedBody.mockImplementation((_event: unknown, safeParse: (v: unknown) => unknown) =>
      safeParse({ duration: 8, threshold: 1.8 })
    )

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 pour un corps invalide', async () => {
    routerParams('SITE001', 'pic')
    mockReadValidatedBody.mockImplementation((_event: unknown, safeParse: (v: unknown) => unknown) =>
      safeParse({ duration: -1, threshold: 1.8 })
    )

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 401 quand requireAccount rejette', async () => {
    mockRequireAccount.mockRejectedValue(Object.assign(new Error('Session invalide'), { statusCode: 401 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 403 pour un compte VIEWER', async () => {
    mockRequireAccount.mockResolvedValue({ ...compteFixture, role: 'VIEWER' })
    routerParams('SITE001', 'pic')

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('autorise un compte ADMIN', async () => {
    mockRequireAccount.mockResolvedValue({ ...compteFixture, role: 'ADMIN' })
    routerParams('SITE001', 'pic')
    mockReadValidatedBody.mockImplementation((_event: unknown, safeParse: (v: unknown) => unknown) =>
      safeParse({ duration: 8, threshold: 1.8 })
    )

    await expect(handler(mockEvent)).resolves.toBeDefined()
  })
})
