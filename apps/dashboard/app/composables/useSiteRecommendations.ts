import { useFetch } from 'nuxt/app'
import { computed } from 'vue'
import type { Ref } from 'vue'
import type { SiteId } from '../types/api'
import type { SiteRecommendationsResponse } from '~~/shared/recommendationSchema'

export function useSiteRecommendations(siteId: Ref<SiteId>) {
  const { data, pending, error } = useFetch<SiteRecommendationsResponse>(
    () => `/api/sites/${siteId.value}/recommendations`,
    { watch: [siteId] }
  )
  const recommendations = computed(() => data.value?.recommendations ?? [])
  const unavailable = computed(() => data.value?.unavailable ?? [])
  return { recommendations, unavailable, pending, error }
}
