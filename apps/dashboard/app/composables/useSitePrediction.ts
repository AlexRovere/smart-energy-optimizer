import type { Prediction, SiteId } from "~/types/api";
import { watchFetchError } from "~/utils/fetchError";

// La prédiction ne part qu'au clic (#257) : en démonstration, on veut voir
// l'appel partir et son retour arriver, pas une courbe déjà là à l'ouverture.
export function useSitePrediction(siteId: Ref<SiteId>, horizonHours: Ref<number> = ref(24)) {
  const { data, pending, error, execute, clear } = useFetch<Prediction>(
    () => `/api/sites/${siteId.value}/prediction`,
    {
      method: 'POST',
      body: computed(() => ({ horizon_hours: horizonHours.value })),
      immediate: false,
      watch: false
    }
  )

  const launched = ref(false)
  const durationMs = ref<number | null>(null)

  async function launch() {
    launched.value = true
    const startedAt = performance.now()
    await execute()
    durationMs.value = Math.round(performance.now() - startedAt)
  }

  // Une courbe calculée pour un autre site ou un autre horizon induirait en
  // erreur : on revient à l'état « pas encore lancé ».
  watch([siteId, horizonHours], () => {
    launched.value = false
    durationMs.value = null
    clear()
  })

  const route = useRoute()
  watchFetchError(error, {
    url: () => `/api/sites/${siteId.value}/prediction`,
    route: () => route.path
  })

  const forecastPoints = computed(() => data.value?.predictions ?? [])

  return {
    forecastPoints,
    modelVersion: computed(() => data.value?.model_version ?? null),
    confidenceLevel: computed(() => data.value?.confidence_level ?? 0),
    predictedAt: computed(() => data.value?.predicted_at ?? null),
    nbPoints: computed(() => forecastPoints.value.length),
    available: computed(() => error.value == null),
    // Motif rendu par la route (#6) : historique insuffisant, modèle absent...
    failureMessage: computed(() => error.value?.statusMessage ?? null),
    launch,
    launched,
    durationMs,
    pending,
    error
  }
}
