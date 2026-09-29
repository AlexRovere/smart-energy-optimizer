import { computed } from 'vue'
import { useFetch, useRoute } from 'nuxt/app'
import type { SiteApiItem } from '~~/shared/siteSchema'
import { watchFetchError } from '../utils/fetchError'

export function useSitesList() {
  const { data, pending, error } = useFetch<SiteApiItem[]>('/api/sites')
  const route = useRoute()
  watchFetchError(error, {
    url: '/api/sites',
    route: () => route.path,
  })
  const sites = computed<SiteApiItem[]>(() => data.value ?? [])
  return { sites, pending, error }
}
