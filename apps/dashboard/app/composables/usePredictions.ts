import { useFetch } from 'nuxt/app'
import { ref, computed } from 'vue'
import type { Prediction, Recommendation, SiteId } from "~/types/api";
import { useSites } from "../composables/useSites";

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

export function usePredictions() {
  const { getReadings, getSiteInfo } = useSites()

  const selectedSiteId = ref<SiteId>('SITE001')

  const prediction = computed(() => mockPredictions(selectedSiteId.value))
  const historicalPoints = computed(() => getReadings(selectedSiteId.value))
  const { data: recommendationsData } = useFetch<Recommendation[]>(
    () => `/api/sites/${selectedSiteId.value}/recommendations`,
    { watch: [selectedSiteId] }
  )
  const recommendations = computed(() => recommendationsData.value ?? [])
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