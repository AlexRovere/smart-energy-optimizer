import { useFetch } from 'nuxt/app'
import { computed } from 'vue'
import type { Ref } from 'vue'
import type { Recommendation, SiteId } from '../types/api'

export function useSiteRecommendations(siteId: Ref<SiteId>) {
  const { data, pending, error } = useFetch<Recommendation[]>(
    () => `/api/sites/${siteId.value}/recommendations`,
    { watch: [siteId] }
  )
  const recommendations = computed(() => data.value ?? [])
  return { recommendations, pending, error }
}
