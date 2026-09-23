import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import handler from '../../../../server/api/sites/[id]/prediction.post'

// vi.hoisted s'exécute AVANT les imports ES : définit defineEventHandler comme global
// pour que le handler Nitro (qui ne l'importe pas explicitement) puisse s'évaluer.
vi.hoisted(() => {
  ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn
})


const {
  mockRequireAccount,
  mockGetRouterParam,
  mockReadValidatedBody,
  mockFetchPredictions,
  mockFetchModelInfo,
  mockHoursInHorizon,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockRequireAccount: vi.fn(),
  mockGetRouterParam: vi.fn(),
  mockReadValidatedBody: vi.fn(),
  mockFetchPredictions: vi.fn(),
  mockFetchModelInfo: vi.fn(),
  mockHoursInHorizon: vi.fn(),
  mockLoggerError: vi.fn(),
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireAccount: mockRequireAccount,
}))

vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>()
  return {
    ...original,
    getRouterParam: mockGetRouterParam,
    readValidatedBody: mockReadValidatedBody,
  }
})

vi.mock('../../../../server/utils/mlClient', () => ({
  fetchPredictions: mockFetchPredictions,
  fetchModelInfo: mockFetchModelInfo,
}))

vi.mock('../../../../server/utils/predictionHorizon', () => ({
  hoursInHorizon: mockHoursInHorizon,
}))

vi.mock('../../../../server/utils/logger', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const heure1 = new Date('2026-09-23T11:00:00Z')
const heure2 = new Date('2026-09-23T12:00:00Z')
const modèleFixture = { name: 'enervision', version: '3', alias: 'champion' }
const compteFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }
const mockEvent = {} as H3Event

describe('POST /api/sites/[id]/prediction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccount.mockResolvedValue(compteFixture)
    mockGetRouterParam.mockReturnValue('SITE001')
    mockReadValidatedBody.mockResolvedValue({ success: true, data: { horizon_hours: 24 } })
    mockHoursInHorizon.mockReturnValue([heure1, heure2])
    mockFetchModelInfo.mockResolvedValue(modèleFixture)
    mockFetchPredictions.mockResolvedValue([
      { site_id: 'SITE001', timestamp: '2026-09-23T11:00:00Z', consumption_kwh: 87.5 },
      { site_id: 'SITE001', timestamp: '2026-09-23T12:00:00Z', consumption_kwh: 91.0 },
    ])
  })

  it('retourne 401 quand requireAccount rejette', async () => {
    mockRequireAccount.mockRejectedValue(Object.assign(new Error('Session invalide'), { statusCode: 401 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('retourne 422 pour un identifiant de site invalide', async () => {
    mockGetRouterParam.mockReturnValue('pas-un-site')

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 si le body est invalide', async () => {
    mockReadValidatedBody.mockResolvedValue({ success: false, error: {} })

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('retourne 422 si horizon_hours dépasse 48', async () => {
    mockReadValidatedBody.mockResolvedValue({ success: false, error: {} })

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('appelle hoursInHorizon avec horizon_hours du corps', async () => {
    mockReadValidatedBody.mockResolvedValue({ success: true, data: { horizon_hours: 48 } })

    await handler(mockEvent)

    expect(mockHoursInHorizon).toHaveBeenCalledWith(expect.any(Date), 48)
  })

  it('appelle fetchPredictions avec les items horaires corrects', async () => {
    await handler(mockEvent)

    expect(mockFetchPredictions).toHaveBeenCalledWith([
      { site_id: 'SITE001', date: '2026-09-23', hour: 11 },
      { site_id: 'SITE001', date: '2026-09-23', hour: 12 },
    ])
  })

  it('mappe consumption_kwh vers predicted_consumption_kw', async () => {
    const résultat = await handler(mockEvent)

    expect(résultat.predictions[0]).toMatchObject({ predicted_consumption_kw: 87.5 })
    expect(résultat.predictions[1]).toMatchObject({ predicted_consumption_kw: 91.0 })
  })

  it('retourne une Prediction conforme avec model_version', async () => {
    const résultat = await handler(mockEvent)

    expect(résultat).toMatchObject({
      site_id: 'SITE001',
      horizon_hours: 24,
      granularity: 'hour',
      model_version: '3',
    })
    expect(typeof résultat.predicted_at).toBe('string')
    expect(résultat.predictions).toHaveLength(2)
  })

  it('retourne 503 si fetchPredictions échoue', async () => {
    mockFetchPredictions.mockRejectedValue(new Error('connect ECONNREFUSED'))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('retourne 503 si fetchModelInfo échoue', async () => {
    mockFetchModelInfo.mockRejectedValue(new Error('connect ECONNREFUSED'))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('journalise l\'erreur en cas d\'indisponibilité du service ML', async () => {
    mockFetchPredictions.mockRejectedValue(new Error('timeout'))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 503 })
    expect(mockLoggerError).toHaveBeenCalledOnce()
  })
})
