import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recommendationsForSite } from '../../../server/utils/recommendationsForSite'
import { detectConsumptionAlertFromHistory } from '../../../server/utils/consumptionAlertFromHistory'
import { detectSpikeAlertFromHistory } from '../../../server/utils/spikeAlertFromHistory'
import { detectConsumptionAlertsFromPredictions } from '../../../server/utils/consumptionAlertFromPredictions'
import { detectSpikeAlertsFromPredictions } from '../../../server/utils/spikeAlertFromPredictions'

vi.mock('../../../server/utils/consumptionAlertFromHistory', () => ({
  detectConsumptionAlertFromHistory: vi.fn()
}))
vi.mock('../../../server/utils/spikeAlertFromHistory', () => ({
  detectSpikeAlertFromHistory: vi.fn()
}))
vi.mock('../../../server/utils/consumptionAlertFromPredictions', () => ({
  detectConsumptionAlertsFromPredictions: vi.fn()
}))
vi.mock('../../../server/utils/spikeAlertFromPredictions', () => ({
  detectSpikeAlertsFromPredictions: vi.fn()
}))

const mockConsumptionHistory = vi.mocked(detectConsumptionAlertFromHistory)
const mockSpikeHistory = vi.mocked(detectSpikeAlertFromHistory)
const mockConsumptionPredictions = vi.mocked(detectConsumptionAlertsFromPredictions)
const mockSpikePredictions = vi.mocked(detectSpikeAlertsFromPredictions)

const REFERENCE = new Date('2026-09-18T10:00:00Z')
const DB = {} as never
const NO_CONSUMPTION_ALERT = { alert: false, average: null, thresholdKwh: 200 }
const NO_SPIKE_ALERT = { alert: false, currentValue: null, average: null, thresholdKw: null }

describe('recommendationsForSite', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockConsumptionHistory.mockResolvedValue(NO_CONSUMPTION_ALERT)
    mockSpikeHistory.mockResolvedValue(NO_SPIKE_ALERT)
    mockConsumptionPredictions.mockResolvedValue([])
    mockSpikePredictions.mockResolvedValue([])
  })

  it('ne rend rien quand rien ne se déclenche', async () => {
    expect(await recommendationsForSite(DB, 'SITE001', REFERENCE)).toEqual({ recommendations: [], unavailable: [] })
  })

  it('recommande sur une alerte conso réelle du jour, source threshold', async () => {
    mockConsumptionHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })

    const { recommendations: result } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      site_id: 'SITE001',
      source: 'threshold',
      type: 'efficiency',
      trigger: { timestamp: REFERENCE.toISOString(), value_kw: 230, threshold_kw: 200 }
    })
  })

  it('recommande sur une alerte pic réelle du jour, source threshold', async () => {
    mockSpikeHistory.mockResolvedValue({ alert: true, currentValue: 310, average: 200, thresholdKw: 300 })

    const { recommendations: result } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      site_id: 'SITE001',
      source: 'threshold',
      type: 'load_balancing',
      trigger: { timestamp: REFERENCE.toISOString(), value_kw: 310, threshold_kw: 300 }
    })
  })

  it('retombe sur la première heure prédite en alerte quand rien ne se déclenche aujourd\'hui', async () => {
    mockConsumptionPredictions.mockResolvedValue([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: false, average: 150, thresholdKwh: 200 },
      { timestamp: '2026-09-18T12:00:00.000Z', alert: true, average: 210, thresholdKwh: 200 }
    ])

    const { recommendations: result } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      source: 'forecast',
      trigger: { timestamp: '2026-09-18T12:00:00.000Z', value_kw: 210, threshold_kw: 200 }
    })
  })

  it('préfère le déclenchement réel du jour à une prédiction, si les deux se déclenchent', async () => {
    mockConsumptionHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })
    mockConsumptionPredictions.mockResolvedValue([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: true, average: 500, thresholdKwh: 200 }
    ])

    const { recommendations: result } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(result).toHaveLength(1)
    expect(result[0]!.source).toBe('threshold')
    expect(result[0]!.trigger.value_kw).toBe(230)
  })

  it('rend jusqu\'à deux recommandations, une par type de déclencheur', async () => {
    mockConsumptionHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })
    mockSpikeHistory.mockResolvedValue({ alert: true, currentValue: 310, average: 200, thresholdKw: 300 })

    const { recommendations: result } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(result.map(r => r.type).sort()).toEqual(['efficiency', 'load_balancing'])
  })

  it('trie les recommandations par urgence décroissante (high avant medium)', async () => {
    mockConsumptionHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })
    mockSpikeHistory.mockResolvedValue({ alert: true, currentValue: 310, average: 200, thresholdKw: 300 })

    const { recommendations: result } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(result).toHaveLength(2)
    expect(result[0]!.priority).toBe('high')
    expect(result[1]!.priority).toBe('medium')
  })

  it("interroge les prédictions sur 48 h, horizon au-delà duquel une alerte n'est plus actionnable", async () => {
    await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(mockConsumptionPredictions).toHaveBeenCalledWith(DB, 'SITE001', REFERENCE, 48)
    expect(mockSpikePredictions).toHaveBeenCalledWith(DB, 'SITE001', REFERENCE, 48)
  })

  it('retourne les recommandations de seuil même quand le ML est indisponible', async () => {
    mockConsumptionHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })
    mockSpikeHistory.mockResolvedValue({ alert: true, currentValue: 310, average: 200, thresholdKw: 300 })
    mockConsumptionPredictions.mockRejectedValue(new Error('ML service unavailable'))
    mockSpikePredictions.mockRejectedValue(new Error('ML service unavailable'))

    const { recommendations: result } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(result).toHaveLength(2)
    expect(result.every(r => r.source === 'threshold')).toBe(true)
  })

  it('retourne un tableau vide quand ni l\'historique ni le ML ne sont disponibles', async () => {
    mockConsumptionPredictions.mockRejectedValue(new Error('ML service unavailable'))
    mockSpikePredictions.mockRejectedValue(new Error('ML service unavailable'))

    const { recommendations: result } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(result).toEqual([])
  })

  it('retourne un tableau vide quand l\'historique Parquet est inaccessible', async () => {
    mockConsumptionHistory.mockRejectedValue(new Error("NUXT_PARQUET_DIR n'est pas défini — historique indisponible"))
    mockSpikeHistory.mockRejectedValue(new Error("NUXT_PARQUET_DIR n'est pas défini — historique indisponible"))

    const { recommendations: result } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(result).toEqual([])
  })

  it('dit que la prévision a manqué quand le ML est indisponible', async () => {
    mockConsumptionPredictions.mockRejectedValue(new Error('ML service unavailable'))
    mockSpikePredictions.mockRejectedValue(new Error('ML service unavailable'))

    const { unavailable } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(unavailable).toEqual(['forecast'])
  })

  it("dit que l'historique a manqué quand le Parquet est inaccessible", async () => {
    mockConsumptionHistory.mockRejectedValue(new Error('historique indisponible'))
    mockSpikeHistory.mockRejectedValue(new Error('historique indisponible'))

    const { unavailable } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(unavailable).toEqual(['history'])
  })

  it("ne signale rien quand une alerte du jour dispense d'interroger la prévision", async () => {
    mockConsumptionHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })
    mockSpikeHistory.mockResolvedValue({ alert: true, currentValue: 310, average: 200, thresholdKw: 300 })
    mockConsumptionPredictions.mockRejectedValue(new Error('ML service unavailable'))

    const { unavailable } = await recommendationsForSite(DB, 'SITE001', REFERENCE)

    expect(unavailable).toEqual([])
  })
})
