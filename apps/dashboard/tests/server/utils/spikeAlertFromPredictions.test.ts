import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectSpikeAlertsFromPredictions } from '../../../server/utils/spikeAlertFromPredictions'
import { fetchPredictions } from '../../../server/utils/mlClient'
import { getAlertThreshold } from '../../../server/utils/alertThresholdsRepository'
import { querySiteHistory } from '../../../server/utils/parquetReader'

vi.mock('../../../server/utils/mlClient', () => ({
  fetchPredictions: vi.fn()
}))
vi.mock('../../../server/utils/alertThresholdsRepository', () => ({
  getAlertThreshold: vi.fn()
}))
vi.mock('../../../server/utils/parquetReader', () => ({
  querySiteHistory: vi.fn()
}))

const mockFetchPredictions = vi.mocked(fetchPredictions)
const mockGetAlertThreshold = vi.mocked(getAlertThreshold)
const mockQuerySiteHistory = vi.mocked(querySiteHistory)

const RÉFÉRENCE = new Date('2026-09-18T10:00:00Z')
const DB = {} as never

describe('detectSpikeAlertsFromPredictions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetAlertThreshold.mockResolvedValue({ duration: 3, threshold: 1.5 })
    mockQuerySiteHistory.mockResolvedValue([])
  })

  it('compare chaque heure prédite à la moyenne des heures qui la précèdent, jamais à elle-même', async () => {
    // Sans contexte, la 1re heure prédite n'a aucune précédente : pas de moyenne, pas d'alerte,
    // quelle que soit sa propre valeur.
    mockFetchPredictions.mockResolvedValue([
      { site_id: 'SITE001', timestamp: '2026-09-18T11:00:00', consumption_kwh: 500 }
    ])

    const résultat = await detectSpikeAlertsFromPredictions(DB, 'SITE001', RÉFÉRENCE, 1)

    expect(résultat).toEqual([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: false, currentValue: 500, average: null, thresholdKw: null }
    ])
  })

  it('déclenche sur un pic prédit au-delà de la moyenne des heures précédentes × seuil', async () => {
    mockFetchPredictions.mockResolvedValue([
      { site_id: 'SITE001', timestamp: '2026-09-18T11:00:00', consumption_kwh: 100 },
      { site_id: 'SITE001', timestamp: '2026-09-18T12:00:00', consumption_kwh: 100 },
      { site_id: 'SITE001', timestamp: '2026-09-18T13:00:00', consumption_kwh: 300 }
    ])

    const résultat = await detectSpikeAlertsFromPredictions(DB, 'SITE001', RÉFÉRENCE, 3)

    // 13h : moyenne de 11h et 12h (100, 100) = 100 ; 300 >= 100 × 1.5 → alerte.
    expect(résultat).toEqual([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: false, currentValue: 100, average: null, thresholdKw: null },
      { timestamp: '2026-09-18T12:00:00.000Z', alert: false, currentValue: 100, average: 100, thresholdKw: 150 },
      { timestamp: '2026-09-18T13:00:00.000Z', alert: true, currentValue: 300, average: 100, thresholdKw: 150 }
    ])
  })

  it('mêle le contexte historique aux prédictions pour la moyenne des premières heures', async () => {
    mockQuerySiteHistory.mockResolvedValue([
      { timestamp: '2026-09-18T09:00:00Z', site_id: 'SITE001', consumption_kwh: 100, consumption_kw: null, null_reasons: [], data_quality: 'good' },
      { timestamp: '2026-09-18T10:00:00Z', site_id: 'SITE001', consumption_kwh: 100, consumption_kw: null, null_reasons: [], data_quality: 'good' }
    ])
    mockFetchPredictions.mockResolvedValue([
      { site_id: 'SITE001', timestamp: '2026-09-18T11:00:00', consumption_kwh: 200 }
    ])

    const résultat = await detectSpikeAlertsFromPredictions(DB, 'SITE001', RÉFÉRENCE, 1)

    // Moyenne du contexte (100, 100) = 100 ; 200 >= 100 × 1.5 (150) → alerte.
    expect(résultat).toEqual([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: true, currentValue: 200, average: 100, thresholdKw: 150 }
    ])
  })
})
