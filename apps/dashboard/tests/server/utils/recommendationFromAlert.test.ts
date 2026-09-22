import { describe, expect, it } from 'vitest'
import { buildRecommendation } from '../../../server/utils/recommendationFromAlert'

const TRIGGER = { timestamp: '2026-09-18T11:00:00.000Z', valueKw: 230, thresholdKw: 200 }

describe('buildRecommendation', () => {
  it('mappe une alerte conso : titre et description dédiés, type efficiency', () => {
    const recommandation = buildRecommendation('SITE001', 'conso', 'threshold', TRIGGER)

    expect(recommandation).toEqual({
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
    expect(recommandation.title).toBeTruthy()
    expect(recommandation.description).toBeTruthy()
  })

  it('mappe une alerte pic : titre et description dédiés, type load_balancing, priorité high', () => {
    const recommandation = buildRecommendation('SITE002', 'pic', 'threshold', TRIGGER)

    expect(recommandation.type).toBe('load_balancing')
    expect(recommandation.priority).toBe('high')
    expect(recommandation.title).toBeTruthy()
    expect(recommandation.description).toBeTruthy()
  })

  it('conso et pic ont des titres différents', () => {
    const conso = buildRecommendation('SITE001', 'conso', 'threshold', TRIGGER)
    const pic = buildRecommendation('SITE001', 'pic', 'threshold', TRIGGER)

    expect(conso.title).not.toBe(pic.title)
  })

  it('propage la source (threshold pour l\'historique, forecast pour une prédiction)', () => {
    const prévu = buildRecommendation('SITE001', 'conso', 'forecast', TRIGGER)

    expect(prévu.source).toBe('forecast')
  })

  it('identifiant de recommandation déterministe, stable pour le même déclenchement', () => {
    const première = buildRecommendation('SITE001', 'pic', 'threshold', TRIGGER)
    const seconde = buildRecommendation('SITE001', 'pic', 'threshold', TRIGGER)

    expect(première.recommendation_id).toBe(seconde.recommendation_id)
  })
})
