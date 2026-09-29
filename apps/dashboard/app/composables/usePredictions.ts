import { useFetch } from 'nuxt/app'
import { ref, computed } from 'vue'
import type { Recommendation, SiteId } from "~/types/api";
import type { SiteRecommendationsResponse } from "~~/shared/recommendationSchema";
import { useSites } from "../composables/useSites";
import { useSitePrediction } from "../composables/useSitePrediction";
import { useSiteHistory } from "../composables/useSiteHistory";

// Page Prédictions : prévision du service ML (déclenchée au clic, #257),
// historique réel des dernières 24 h et indicateurs dérivés.
export function usePredictions() {
  const { getSiteInfo } = useSites()

  const selectedSiteId = ref<SiteId>('SITE001')
  const horizonHeures = ref(24)

  const prediction = useSitePrediction(selectedSiteId, horizonHeures)
  const { readings: historicalPoints } = useSiteHistory(selectedSiteId, ref<'24h' | '7j'>('24h'))

  const { data: recommendationsData } = useFetch<SiteRecommendationsResponse>(
    () => `/api/sites/${selectedSiteId.value}/recommendations`,
    { watch: [selectedSiteId] }
  )
  const recommendations = computed<Recommendation[]>(() => recommendationsData.value?.recommendations ?? [])

  const siteInfo = computed(() => getSiteInfo(selectedSiteId.value))
  const thresholdKw = computed(() => siteInfo.value?.threshold_kw ?? 240)

  const pic = computed(() => {
    const points = prediction.forecastPoints.value
    if (points.length === 0) return null
    return points.reduce((max, p) => p.predicted_consumption_kw > max.predicted_consumption_kw ? p : max)
  })
  const peakKw = computed(() => pic.value?.predicted_consumption_kw ?? null)
  const marginKw = computed(() => peakKw.value == null ? null : thresholdKw.value - peakKw.value)
  const exceedanceExpected = computed(() =>
    prediction.forecastPoints.value.some(p => p.predicted_consumption_kw >= thresholdKw.value)
  )
  const peakTime = computed(() => {
    if (!pic.value) return null
    return new Date(pic.value.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    })
  })

  return {
    ...prediction,
    selectedSiteId,
    horizonHeures,
    siteInfo,
    historicalPoints,
    recommendations,
    thresholdKw,
    peakKw,
    peakTime,
    marginKw,
    exceedanceExpected
  }
}
