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

const mockConsoHistory = vi.mocked(detectConsumptionAlertFromHistory)
const mockSpikeHistory = vi.mocked(detectSpikeAlertFromHistory)
const mockConsoPredictions = vi.mocked(detectConsumptionAlertsFromPredictions)
const mockSpikePredictions = vi.mocked(detectSpikeAlertsFromPredictions)

const RÉFÉRENCE = new Date('2026-09-18T10:00:00Z')
const DB = {} as never
const AUCUNE_ALERTE_CONSO = { alert: false, average: null, thresholdKwh: 200 }
const AUCUNE_ALERTE_PIC = { alert: false, currentValue: null, average: null, thresholdKw: null }

describe('recommendationsForSite', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockConsoHistory.mockResolvedValue(AUCUNE_ALERTE_CONSO)
    mockSpikeHistory.mockResolvedValue(AUCUNE_ALERTE_PIC)
    mockConsoPredictions.mockResolvedValue([])
    mockSpikePredictions.mockResolvedValue([])
  })

  it('ne rend rien quand rien ne se déclenche', async () => {
    expect(await recommendationsForSite(DB, 'SITE001', RÉFÉRENCE)).toEqual([])
  })

  it('recommande sur une alerte conso réelle du jour, source threshold', async () => {
    mockConsoHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })

    const résultat = await recommendationsForSite(DB, 'SITE001', RÉFÉRENCE)

    expect(résultat).toHaveLength(1)
    expect(résultat[0]).toMatchObject({
      site_id: 'SITE001',
      source: 'threshold',
      type: 'efficiency',
      trigger: { timestamp: RÉFÉRENCE.toISOString(), value_kw: 230, threshold_kw: 200 }
    })
  })

  it('recommande sur une alerte pic réelle du jour, source threshold', async () => {
    mockSpikeHistory.mockResolvedValue({ alert: true, currentValue: 310, average: 200, thresholdKw: 300 })

    const résultat = await recommendationsForSite(DB, 'SITE001', RÉFÉRENCE)

    expect(résultat).toHaveLength(1)
    expect(résultat[0]).toMatchObject({
      site_id: 'SITE001',
      source: 'threshold',
      type: 'load_balancing',
      trigger: { timestamp: RÉFÉRENCE.toISOString(), value_kw: 310, threshold_kw: 300 }
    })
  })

  it('retombe sur la première heure prédite en alerte quand rien ne se déclenche aujourd\'hui', async () => {
    mockConsoPredictions.mockResolvedValue([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: false, average: 150, thresholdKwh: 200 },
      { timestamp: '2026-09-18T12:00:00.000Z', alert: true, average: 210, thresholdKwh: 200 }
    ])

    const résultat = await recommendationsForSite(DB, 'SITE001', RÉFÉRENCE)

    expect(résultat).toHaveLength(1)
    expect(résultat[0]).toMatchObject({
      source: 'forecast',
      trigger: { timestamp: '2026-09-18T12:00:00.000Z', value_kw: 210, threshold_kw: 200 }
    })
  })

  it('préfère le déclenchement réel du jour à une prédiction, si les deux se déclenchent', async () => {
    mockConsoHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })
    mockConsoPredictions.mockResolvedValue([
      { timestamp: '2026-09-18T11:00:00.000Z', alert: true, average: 500, thresholdKwh: 200 }
    ])

    const résultat = await recommendationsForSite(DB, 'SITE001', RÉFÉRENCE)

    expect(résultat).toHaveLength(1)
    expect(résultat[0]!.source).toBe('threshold')
    expect(résultat[0]!.trigger.value_kw).toBe(230)
  })

  it('rend jusqu\'à deux recommandations, une par type de déclencheur', async () => {
    mockConsoHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })
    mockSpikeHistory.mockResolvedValue({ alert: true, currentValue: 310, average: 200, thresholdKw: 300 })

    const résultat = await recommendationsForSite(DB, 'SITE001', RÉFÉRENCE)

    expect(résultat.map(r => r.type).sort()).toEqual(['efficiency', 'load_balancing'])
  })

  it('trie les recommandations par urgence décroissante (high avant medium)', async () => {
    mockConsoHistory.mockResolvedValue({ alert: true, average: 230, thresholdKwh: 200 })
    mockSpikeHistory.mockResolvedValue({ alert: true, currentValue: 310, average: 200, thresholdKw: 300 })

    const résultat = await recommendationsForSite(DB, 'SITE001', RÉFÉRENCE)

    expect(résultat).toHaveLength(2)
    expect(résultat[0]!.priority).toBe('high')
    expect(résultat[1]!.priority).toBe('medium')
  })

  it('interroge les prédictions sur l\'horizon complet de 168h', async () => {
    await recommendationsForSite(DB, 'SITE001', RÉFÉRENCE)

    expect(mockConsoPredictions).toHaveBeenCalledWith(DB, 'SITE001', RÉFÉRENCE, 168)
    expect(mockSpikePredictions).toHaveBeenCalledWith(DB, 'SITE001', RÉFÉRENCE, 168)
  })
})
