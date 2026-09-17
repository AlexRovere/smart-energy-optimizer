import type { Prediction, Recommendation, SiteId } from "~/types/api";

const HORIZON_HOURS = 6
const CONFIDENCE_LEVEL = 0.90
const MODEL_VERSION = '1.0.0-demo'

function mockPredictions(siteId: SiteId): Prediction {
  const base = new Date()
  base.setMinutes(0, 0, 0)

  const BASE_VALUES: Record<SiteId, number> = {
    SITE001: 98, SITE002: 580, SITE003: 410, SITE004: 88,
    SITE005: 200, SITE006: 62, SITE007: 190
  }

  const base_kw = BASE_VALUES[siteId] ?? 100
  const VARIATION = [0, 2, -3, 4, 1, -2]

  return {
    site_id: siteId,
    predicted_at: new Date().toISOString(),
    horizon_hours: HORIZON_HOURS,
    granularity: 'hour',
    model_version: MODEL_VERSION,
    confidence_level: CONFIDENCE_LEVEL,
    predictions: VARIATION.map((delta, i) => {
      const predicted = base_kw + delta
      return {
        timestamp: new Date(base.getTime() + (i + 1) * 3_600_000).toISOString(),
        predicted_consumption_kw: predicted,
        confidence_lower: predicted - 8,
        confidence_upper: predicted + 8
      }
    })
  }
}

function mockRecommendations(siteId: SiteId): Recommendation[] {
  const now = new Date().toISOString()
  return [
    {
      recommendation_id: `REC-${siteId}-1`,
      site_id: siteId,
      source: 'forecast',
      type: 'scheduling',
      priority: 'high',
      title: 'Décaler la relance CVC de 45 min',
      description: 'fenêtre 14:30 → 15:15 · confiance haute',
      trigger: { timestamp: now, value_kw: 98, threshold_kw: 240 },
      estimated_saving_kwh: 12,
      gain_kw: -17,
      confidence: 0.88,
      window: '14:30 → 15:15',
    },
    {
      recommendation_id: `REC-${siteId}-2`,
      site_id: siteId,
      source: 'forecast',
      type: 'load_balancing',
      priority: 'medium',
      title: 'Reporter le lot de production non prioritaire',
      description: 'fenêtre 15:00 → 17:00 · impact planning',
      trigger: { timestamp: now, value_kw: 98, threshold_kw: 240 },
      estimated_saving_kwh: 58,
      gain_kw: -29,
      confidence: 0.74,
      window: '15:00 → 17:00',
    },
    {
      recommendation_id: `REC-${siteId}-3`,
      site_id: siteId,
      source: 'threshold',
      type: 'efficiency',
      priority: 'low',
      title: 'Alterner les compresseurs 2 et 3',
      description: 'fenêtre immédiate · sans impact process',
      trigger: { timestamp: now, value_kw: 98, threshold_kw: 240 },
      estimated_saving_kwh: 7,
      gain_kw: -11,
      confidence: 0.91,
      window: 'immédiate',
    },
  ]
}

export function usePredictions() {
  const { getReadings, getSiteInfo } = useSites()

  const selectedSiteId = ref<SiteId>('SITE001')

  const prediction = computed(() => mockPredictions(selectedSiteId.value))
  const historicalPoints = computed(() => getReadings(selectedSiteId.value))
  const recommendations = computed(() => mockRecommendations(selectedSiteId.value))
  const siteInfo = computed(() => getSiteInfo(selectedSiteId.value))
  const thresholdKw = computed(() => siteInfo.value?.threshold_kw ?? 240)
  const peakKw = computed(() => 
    Math.max(...prediction.value.predictions.map(p => p.predicted_consumption_kw))
  )
  const marginKw = computed(() => thresholdKw.value - peakKw.value)
  const exceedanceExpected = computed(() => 
    prediction.value.predictions.some(p => p.predicted_consumption_kw >= thresholdKw.value)
  )
  const modelConfidence = computed(() =>
    Math.round(prediction.value.confidence_level * 100)
  )
  const peakTime = computed(() => {
    const peak = prediction.value.predictions.find(
      p => p.predicted_consumption_kw === peakKw.value
    )
    if (!peak) return '--'
    return new Date(peak.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    })
  })

  return {
    selectedSiteId,
    siteInfo,
    prediction,
    historicalPoints,
    recommendations,
    thresholdKw,
    peakKw,
    peakTime,
    marginKw,
    exceedanceExpected,
    modelConfidence
  }
}