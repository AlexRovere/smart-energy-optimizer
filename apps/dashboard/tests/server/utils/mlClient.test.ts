import { beforeEach, describe, expect, it, vi } from 'vitest'
import { $fetch } from 'ofetch'
import { fetchPredictions } from '../../../server/utils/mlClient'

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
    const réponse = [
      { site_id: 'SITE001', timestamp: '2026-09-18T14:00:00', consumption_kwh: 235.5 }
    ]
    mocked$fetch.mockResolvedValueOnce(réponse)

    const résultat = await fetchPredictions([{ site_id: 'SITE001', date: '2026-09-18', hour: 14 }], BASE_URL)

    expect(résultat).toEqual(réponse)
  })
})
