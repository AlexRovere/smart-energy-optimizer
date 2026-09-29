import { beforeEach, describe, expect, it, vi } from 'vitest'
import { $fetch } from 'ofetch'
import { fetchPredictions, fetchModelInfo, triggerTraining } from '../../../server/utils/mlClient'

vi.mock('ofetch', () => ({
  $fetch: vi.fn()
}))

const BASE_URL = 'http://ml:8000'
const mocked$fetch = vi.mocked($fetch)

describe('fetchPredictions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('poste les requêtes sur /predictions, à la base du service ML', async () => {
    mocked$fetch.mockResolvedValueOnce([])

    await fetchPredictions([{ site_id: 'SITE001', date: '2026-09-18', hour: 14 }], BASE_URL)

    expect(mocked$fetch).toHaveBeenCalledWith(
      '/predictions',
      expect.objectContaining({
        baseURL: BASE_URL,
        method: 'POST',
        body: [{ site_id: 'SITE001', date: '2026-09-18', hour: 14 }]
      })
    )
  })

  it('rend les prédictions telles que rendues par le service', async () => {
    const response = [
      { site_id: 'SITE001', timestamp: '2026-09-18T14:00:00', consumption_kwh: 235.5 }
    ]
    mocked$fetch.mockResolvedValueOnce(response)

    const result = await fetchPredictions([{ site_id: 'SITE001', date: '2026-09-18', hour: 14 }], BASE_URL)

    expect(result).toEqual(response)
  })
})

describe('fetchModelInfo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('interroge GET /model à la base du service ML', async () => {
    mocked$fetch.mockResolvedValueOnce({ name: 'enervision', version: '3', alias: 'champion' })

    await fetchModelInfo(BASE_URL)

    expect(mocked$fetch).toHaveBeenCalledWith(
      '/model',
      expect.objectContaining({
        baseURL: BASE_URL,
        method: 'GET'
      })
    )
  })

  it('rend le ModelInfo tel que rendu par le service', async () => {
    const response = { name: 'enervision', version: '3', alias: 'champion' }
    mocked$fetch.mockResolvedValueOnce(response)

    const result = await fetchModelInfo(BASE_URL)

    expect(result).toEqual(response)
  })

  it('transmet les champs enrichis creation_timestamp et metrics', async () => {
    const response = {
      name: 'enervision',
      version: '3',
      alias: 'champion',
      creation_timestamp: 1_700_000_000_000,
      metrics: { training_rows: 5000 },
    }
    mocked$fetch.mockResolvedValueOnce(response)

    const result = await fetchModelInfo(BASE_URL)

    expect(result.creation_timestamp).toBe(1_700_000_000_000)
    expect(result.metrics).toEqual({ training_rows: 5000 })
  })

  it("propage l'erreur si le service ML est indisponible", async () => {
    mocked$fetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))

    await expect(fetchModelInfo(BASE_URL)).rejects.toThrow('connect ECONNREFUSED')
  })
})

describe('triggerTraining', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('poste sur POST /train à la base du service ML', async () => {
    mocked$fetch.mockResolvedValueOnce({ status: 'started' })

    await triggerTraining(BASE_URL)

    expect(mocked$fetch).toHaveBeenCalledWith(
      '/training',
      expect.objectContaining({
        baseURL: BASE_URL,
        method: 'POST'
      })
    )
  })

  it('rend la réponse telle que rendue par le service', async () => {
    const response = { status: 'started' }
    mocked$fetch.mockResolvedValueOnce(response)

    const result = await triggerTraining(BASE_URL)

    expect(result).toEqual(response)
  })

  it("propage l'erreur si le service ML est indisponible", async () => {
    mocked$fetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))

    await expect(triggerTraining(BASE_URL)).rejects.toThrow('connect ECONNREFUSED')
  })
})
