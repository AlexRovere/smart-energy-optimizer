import { describe, expect, it } from 'vitest'
import { usePredictions } from '../../app/composables/usePredictions'

describe('usePredictions', () => {
  it('sélectionne SITE001 par défaut', () => {
    const { selectedSiteId } = usePredictions()
    expect(selectedSiteId.value).toBe('SITE001')
  })

  it('retourne 6 points de prévision (horizon 6 h, granularité horaire)', () => {
    const { prediction } = usePredictions()
    expect(prediction.value.predictions).toHaveLength(6)
  })

  it('chaque point de prévision a les champs requis', () => {
    const { prediction } = usePredictions()
    for (const pt of prediction.value.predictions) {
      expect(pt.timestamp).toBeTruthy()
      expect(typeof pt.predicted_consumption_kw).toBe('number')
      expect(typeof pt.confidence_lower).toBe('number')
      expect(typeof pt.confidence_upper).toBe('number')
      expect(pt.confidence_lower).toBeLessThanOrEqual(pt.predicted_consumption_kw)
      expect(pt.confidence_upper).toBeGreaterThanOrEqual(pt.predicted_consumption_kw)
    }
  })

  it('retourne 24 points historiques', () => {
    const { historicalPoints } = usePredictions()
    expect(historicalPoints.value).toHaveLength(24)
  })

  it('peakKw est le maximum des predicted_consumption_kw', () => {
    const { prediction, peakKw } = usePredictions()
    const expected = Math.max(...prediction.value.predictions.map(p => p.predicted_consumption_kw))
    expect(peakKw.value).toBe(expected)
  })

  it('marginKw est positif quand aucun point ne dépasse le seuil', () => {
    const { marginKw, exceedanceExpected } = usePredictions()
    if (!exceedanceExpected.value) {
      expect(marginKw.value).toBeGreaterThan(0)
    }
  })

  it('marginKw = thresholdKw - peakKw', () => {
    const { marginKw, thresholdKw, peakKw } = usePredictions()
    expect(marginKw.value).toBe(thresholdKw.value - peakKw.value)
  })

  it('exceedanceExpected est false quand tous les points restent sous le seuil', () => {
    const { prediction, thresholdKw, exceedanceExpected } = usePredictions()
    const allUnder = prediction.value.predictions.every(p => p.predicted_consumption_kw < thresholdKw.value)
    expect(exceedanceExpected.value).toBe(!allUnder)
  })

  it('modelConfidence est un entier entre 0 et 100', () => {
    const { modelConfidence } = usePredictions()
    expect(modelConfidence.value).toBeGreaterThanOrEqual(0)
    expect(modelConfidence.value).toBeLessThanOrEqual(100)
    expect(Number.isInteger(modelConfidence.value)).toBe(true)
  })

  it('retourne 3 recommandations pour SITE001', () => {
    const { recommendations } = usePredictions()
    expect(recommendations.value).toHaveLength(3)
  })

  it('chaque recommandation a les champs requis', () => {
    const { recommendations } = usePredictions()
    for (const rec of recommendations.value) {
      expect(rec.recommendation_id).toBeTruthy()
      expect(rec.site_id).toBeTruthy()
      expect(rec.title).toBeTruthy()
      expect(typeof rec.gain_kw).toBe('number')
      expect(rec.gain_kw).toBeLessThan(0)
      expect(rec.confidence).toBeGreaterThan(0)
      expect(rec.confidence).toBeLessThanOrEqual(1)
      expect(rec.window).toBeTruthy()
    }
  })

  it('prediction.site_id correspond à selectedSiteId', () => {
    const { prediction, selectedSiteId } = usePredictions()
    expect(prediction.value.site_id).toBe(selectedSiteId.value)
  })

  it('les recommandations correspondent au site sélectionné', () => {
    const { recommendations, selectedSiteId } = usePredictions()
    for (const rec of recommendations.value) {
      expect(rec.site_id).toBe(selectedSiteId.value)
    }
  })

  it('changer selectedSiteId met à jour prediction.site_id', () => {
    const { prediction, selectedSiteId } = usePredictions()
    selectedSiteId.value = 'SITE002'
    expect(prediction.value.site_id).toBe('SITE002')
  })

  it('changer selectedSiteId met à jour les recommandations', () => {
    const { recommendations, selectedSiteId } = usePredictions()
    selectedSiteId.value = 'SITE003'
    for (const rec of recommendations.value) {
      expect(rec.site_id).toBe('SITE003')
    }
  })

  it('prediction.confidence_level correspond à modelConfidence / 100', () => {
    const { prediction, modelConfidence } = usePredictions()
    expect(prediction.value.confidence_level).toBeCloseTo(modelConfidence.value / 100, 2)
  })
})
