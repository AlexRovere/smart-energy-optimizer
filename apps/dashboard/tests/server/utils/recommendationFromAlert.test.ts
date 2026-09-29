import { describe, expect, it } from 'vitest'
import { buildRecommendation } from '../../../server/utils/recommendationFromAlert'

const TRIGGER = { timestamp: '2026-09-18T11:00:00.000Z', valueKw: 230, thresholdKw: 200 }

describe('buildRecommendation', () => {
  it('mappe une alerte conso : titre et description dédiés, type efficiency', () => {
    const recommendationItem = buildRecommendation('SITE001', 'conso', 'threshold', TRIGGER)

    expect(recommendationItem).toEqual({
      recommendation_id: 'REC-SITE001-conso-2026-09-18T11:00:00.000Z',
      site_id: 'SITE001',
      source: 'threshold',
      type: 'efficiency',
      priority: 'medium',
      title: expect.any(String),
      description: expect.any(String),
      trigger: { timestamp: TRIGGER.timestamp, value_kw: 230, threshold_kw: 200 },
      estimated_saving_kwh: 0,
      gain_kw: 0,
      confidence: 0,
      window: 'N/A'
    })
    expect(recommendationItem.title).toBeTruthy()
    expect(recommendationItem.description).toBeTruthy()
  })

  it('mappe une alerte pic : titre et description dédiés, type load_balancing, priorité high', () => {
    const recommendationItem = buildRecommendation('SITE002', 'pic', 'threshold', TRIGGER)

    expect(recommendationItem.type).toBe('load_balancing')
    expect(recommendationItem.priority).toBe('high')
    expect(recommendationItem.title).toBeTruthy()
    expect(recommendationItem.description).toBeTruthy()
  })

  it('conso et pic ont des titres différents', () => {
    const conso = buildRecommendation('SITE001', 'conso', 'threshold', TRIGGER)
    const pic = buildRecommendation('SITE001', 'pic', 'threshold', TRIGGER)

    expect(conso.title).not.toBe(pic.title)
  })

  it('propage la source (threshold pour l\'historique, forecast pour une prédiction)', () => {
    const forecasted = buildRecommendation('SITE001', 'conso', 'forecast', TRIGGER)

    expect(forecasted.source).toBe('forecast')
  })

  it('identifiant de recommandation déterministe, stable pour le même déclenchement', () => {
    const first = buildRecommendation('SITE001', 'pic', 'threshold', TRIGGER)
    const second = buildRecommendation('SITE001', 'pic', 'threshold', TRIGGER)

    expect(first.recommendation_id).toBe(second.recommendation_id)
  })
})
