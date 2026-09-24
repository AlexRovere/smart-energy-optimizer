import type { Prediction, SiteId } from "~/types/api";
import { observerErreurFetch } from "~/utils/erreurFetch";

// La prédiction ne part qu'au clic (#257) : en démonstration, on veut voir
// l'appel partir et son retour arriver, pas une courbe déjà là à l'ouverture.
export function useSitePrediction(siteId: Ref<SiteId>, horizonHeures: Ref<number> = ref(24)) {
  const { data, pending, error, execute, clear } = useFetch<Prediction>(
    () => `/api/sites/${siteId.value}/prediction`,
    {
      method: 'POST',
      body: computed(() => ({ horizon_hours: horizonHeures.value })),
      immediate: false,
      watch: false
    }
  )

  const lancee = ref(false)
  const dureeMs = ref<number | null>(null)

  async function lancer() {
    lancee.value = true
    const début = performance.now()
    await execute()
    dureeMs.value = Math.round(performance.now() - début)
  }

  // Une courbe calculée pour un autre site ou un autre horizon induirait en
  // erreur : on revient à l'état « pas encore lancé ».
  watch([siteId, horizonHeures], () => {
    lancee.value = false
    dureeMs.value = null
    clear()
  })

  const route = useRoute()
  observerErreurFetch(error, {
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
    lancer,
    lancee,
    dureeMs,
    pending,
    error
  }
}
