import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../server/api/model.get'

vi.hoisted(() => {
  ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn
})

const { mockRequireRole, mockFetchModelInfo } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockFetchModelInfo: vi.fn(),
}))

vi.mock('../../../server/utils/guard', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('../../../server/utils/mlClient', () => ({
  fetchModelInfo: mockFetchModelInfo,
}))

const adminAccount = { id: 'user-uuid', email: 'admin@enervision.fr', role: 'ADMIN' }
const mockEvent = { path: '/api/model' } as H3Event

const championModel = {
  name: 'enervision-catboost',
  version: '4',
  alias: 'champion',
  creation_timestamp: 1_700_000_000_000,
  metriques: { training_rows: 5000 },
}

describe('GET /api/model', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireRole.mockResolvedValue(adminAccount)
    mockFetchModelInfo.mockResolvedValue(championModel)
  })

  it('retourne 403 si le compte n\'est pas ADMIN', async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error('Accès interdit'), { statusCode: 403 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('retourne les informations enrichies du modèle champion', async () => {
    const result = await handler(mockEvent)

    expect(result).toEqual(championModel)
  })

  it('retourne 503 si le service ML est indisponible', async () => {
    mockFetchModelInfo.mockRejectedValue(
      Object.assign(new Error('Aucun modèle champion disponible'), { statusCode: 503 })
    )

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('retourne 502 pour toute autre erreur ML', async () => {
    mockFetchModelInfo.mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED'), { statusCode: 500 })
    )

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 502 })
  })
})
