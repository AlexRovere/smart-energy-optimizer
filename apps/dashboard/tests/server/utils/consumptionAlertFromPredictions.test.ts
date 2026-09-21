import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectConsumptionAlertsFromPredictions } from '../../../server/utils/consumptionAlertFromPredictions'
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

describe('detectConsumptionAlertsFromPredictions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetAlertThreshold.mockResolvedValue({ duration: 3, threshold: 200 })
    mockQuerySiteHistory.mockResolvedValue([])
  })

  it('interroge le service ML pour chaque heure de l\'horizon demandé', async () => {
    mockFetchPredictions.mockResolvedValue([
      { site_id: 'SITE001', timestamp: '2026-09-18T11:00:00', consumption_kwh: 100 },
      { site_id: 'SITE001', timestamp: '2026-09-18T12:00:00', consumption_kwh: 100 }
    ])

    await detectConsumptionAlertsFromPredictions(DB, 'SITE001', RÉFÉRENCE, 2)

    expect(mockFetchPredictions).toHaveBeenCalledWith([
      { site_id: 'SITE001', date: '2026-09-18', hour: 11 },
      { site_id: 'SITE001', date: '2026-09-18', hour: 12 }
    ])
  })

  it('déclenche sur une heure prédite dont la moyenne glissante dépasse le seuil', async () => {
    // duration = 3 : la fenêtre s'étoffe heure après heure, faute de contexte
    // antérieur (mockQuerySiteHistory rend []). Moyennes : 100, 100, 233.3.
    mockFetchPredictions.mockResolvedValue([
      { site_id: 'SITE001', timestamp: '2026-09-18T11:00:00', consumption_kwh: 100 },
      { site_id: 'SITE001', timestamp: '2026-09-18T12:00:00', consumption_kwh: 100 },
      { site_id: 'SITE001', timestamp: '2026-09-18T13:00:00', consumption_kwh: 500 }
    ])

    const résultat = await detectConsumptionAlertsFromPredictions(DB, 'SITE001', RÉFÉRENCE, 3)

    expect(résultat).toEqual([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: false, average: 100, thresholdKwh: 200 },
      { timestamp: '2026-09-18T12:00:00.000Z', alert: false, average: 100, thresholdKwh: 200 },
      { timestamp: '2026-09-18T13:00:00.000Z', alert: true, average: 700 / 3, thresholdKwh: 200 }
    ])
  })

  it('mêle le contexte historique aux prédictions pour les premières heures de l\'horizon', async () => {
    mockQuerySiteHistory.mockResolvedValue([
      { timestamp: '2026-09-18T09:00:00Z', site_id: 'SITE001', consumption_kwh: 300, consumption_kw: null, null_reasons: [], data_quality: 'good' },
      { timestamp: '2026-09-18T10:00:00Z', site_id: 'SITE001', consumption_kwh: 300, consumption_kw: null, null_reasons: [], data_quality: 'good' }
    ])
    mockFetchPredictions.mockResolvedValue([
      { site_id: 'SITE001', timestamp: '2026-09-18T11:00:00', consumption_kwh: 300 }
    ])

    const résultat = await detectConsumptionAlertsFromPredictions(DB, 'SITE001', RÉFÉRENCE, 1)

    // Moyenne des 3 dernières heures (duration = 3) au moment de 11h : 300, 300, 300 → dépasse.
    expect(résultat).toEqual([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: true, average: 300, thresholdKwh: 200 }
    ])
  })

  it('ignore le fuseau absent du datetime rendu par le ML, et se fie à l\'heure demandée', async () => {
    // Si le timestamp renvoyé par le ML ("...T11:00:00", sans Z) était reparsé
    // tel quel, un serveur en heure d'été Europe/Paris le lirait comme 09h UTC :
    // deux heures plus tôt que l'heure réellement demandée et censée déclencher.
    mockFetchPredictions.mockResolvedValue([
      { site_id: 'SITE001', timestamp: '2026-09-18T11:00:00', consumption_kwh: 260 }
    ])

    const résultat = await detectConsumptionAlertsFromPredictions(DB, 'SITE001', RÉFÉRENCE, 1)

    expect(résultat).toEqual([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: true, average: 260, thresholdKwh: 200 }
    ])
  })
})
