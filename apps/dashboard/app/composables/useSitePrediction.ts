import type { Prediction, SiteId } from "~/types/api";
import { observerErreurFetch } from "~/utils/erreurFetch";

export function useSitePrediction(siteId: Ref<SiteId>, horizonHeures: Ref<number> = ref(24)) {
  const { data, pending, error } = useFetch<Prediction>(
    () => `/api/sites/${siteId.value}/prediction`,
    {
      method: 'POST',
      body: computed(() => ({ horizon_hours: horizonHeures.value })),
      watch: [siteId, horizonHeures]
    }
  )

  const route = useRoute()
  observerErreurFetch(error, {
    url: () => `/api/sites/${siteId.value}/prediction`,
    route: () => route.path
  })

  return {
    forecastPoints: computed(() => data.value?.predictions ?? []),
    modelVersion: computed(() => data.value?.model_version ?? null),
    confidenceLevel: computed(() => data.value?.confidence_level ?? 0),
    available: computed(() => error.value == null),
    pending,
    error
  }
}