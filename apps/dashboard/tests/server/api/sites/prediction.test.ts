import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError, type H3Event } from 'h3'
import handler from '../../../../server/api/sites/[id]/prediction.post'

// vi.hoisted s'exécute AVANT les imports ES : définit defineEventHandler comme global
// pour que le handler Nitro (qui ne l'importe pas explicitement) puisse s'évaluer.
vi.hoisted(() => {
  ;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn
})


const {
  mockRequireSiteAccess,
  mockGetRouterParam,
  mockReadValidatedBody,
  mockFetchPredictions,
  mockFetchModelInfo,
  mockHoursInHorizon,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockRequireSiteAccess: vi.fn(),
  mockGetRouterParam: vi.fn(),
  mockReadValidatedBody: vi.fn(),
  mockFetchPredictions: vi.fn(),
  mockFetchModelInfo: vi.fn(),
  mockHoursInHorizon: vi.fn(),
  mockLoggerError: vi.fn(),
}))

vi.mock('../../../../server/utils/guard', () => ({
  requireSiteAccess: mockRequireSiteAccess,
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

const hour1 = new Date('2026-09-23T11:00:00Z')
const hour2 = new Date('2026-09-23T12:00:00Z')
const modelFixture = { name: 'enervision', version: '3', alias: 'champion' }
const accountFixture = { id: 'user-uuid', email: 'test@enervision.fr', role: 'OPERATOR' }
const mockEvent = {} as H3Event

describe('POST /api/sites/[id]/prediction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSiteAccess.mockImplementation(async (_event: unknown, id: string) => ({ account: accountFixture, siteId: id }))
    mockGetRouterParam.mockReturnValue('SITE001')
    mockReadValidatedBody.mockResolvedValue({ success: true, data: { horizon_hours: 24 } })
    mockHoursInHorizon.mockReturnValue([hour1, hour2])
    mockFetchModelInfo.mockResolvedValue(modelFixture)
    mockFetchPredictions.mockResolvedValue([
      { site_id: 'SITE001', timestamp: '2026-09-23T11:00:00Z', consumption_kwh: 87.5 },
      { site_id: 'SITE001', timestamp: '2026-09-23T12:00:00Z', consumption_kwh: 91.0 },
    ])
  })

  it('passe l\'identifiant de la route à la garde de périmètre', async () => {
    await handler(mockEvent)

    expect(mockRequireSiteAccess).toHaveBeenCalledWith(mockEvent, 'SITE001')
  })

  it('retourne 403 sans solliciter le service ML pour un site hors périmètre', async () => {
    mockGetRouterParam.mockReturnValue('SITE002')
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 403 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 403 })
    expect(mockFetchPredictions).not.toHaveBeenCalled()
  })

  it('retourne 404 sans solliciter le service ML pour un site inconnu', async () => {
    mockGetRouterParam.mockReturnValue('SITE999')
    mockRequireSiteAccess.mockRejectedValue(createError({ statusCode: 404 }))

    await expect(handler(mockEvent)).rejects.toMatchObject({ statusCode: 404 })
    expect(mockFetchPredictions).not.toHaveBeenCalled()
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
    const result = await handler(mockEvent)

    expect(result.predictions[0]).toMatchObject({ predicted_consumption_kw: 87.5 })
    expect(result.predictions[1]).toMatchObject({ predicted_consumption_kw: 91.0 })
  })

  it('retourne une Prediction conforme avec model_version', async () => {
    const result = await handler(mockEvent)

    expect(result).toMatchObject({
      site_id: 'SITE001',
      horizon_hours: 24,
      granularity: 'hour',
      model_version: '3',
    })
    expect(typeof result.predicted_at).toBe('string')
    expect(result.predictions).toHaveLength(2)
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

  describe('relaie le motif du service ML', () => {
    // Forme d'une erreur ofetch : le code HTTP et le corps FastAPI `{ detail }`.
    function mlError(statusCode: number, detail: string) {
      return Object.assign(new Error(`[POST] /predictions: ${statusCode}`), { statusCode, data: { detail } })
    }

    it('422 du ML : historique insuffisant ou trop ancien', async () => {
      mockFetchPredictions.mockRejectedValue(mlError(422, 'The latest 168 hours are incomplete'))

      await expect(handler(mockEvent)).rejects.toMatchObject({
        statusCode: 422,
        statusMessage: 'Historique insuffisant ou trop ancien pour prévoir',
      })
    })

    it('503 du ML sans modèle champion : aucun modèle entraîné', async () => {
      mockFetchModelInfo.mockRejectedValue(mlError(503, 'Aucun modèle champion disponible'))

      await expect(handler(mockEvent)).rejects.toMatchObject({
        statusCode: 503,
        statusMessage: 'Aucun modèle entraîné disponible',
      })
    })

    it("503 du ML pour une autre raison : historique illisible par le service", async () => {
      mockFetchPredictions.mockRejectedValue(mlError(503, 'Expected a Parquet directory: /data'))

      await expect(handler(mockEvent)).rejects.toMatchObject({
        statusCode: 503,
        statusMessage: 'Historique illisible par le service de prédiction',
      })
    })

    it('ML injoignable : service de prédiction indisponible', async () => {
      mockFetchPredictions.mockRejectedValue(new Error('connect ECONNREFUSED'))

      await expect(handler(mockEvent)).rejects.toMatchObject({
        statusCode: 503,
        statusMessage: 'Service de prédiction indisponible',
      })
    })
  })
})
