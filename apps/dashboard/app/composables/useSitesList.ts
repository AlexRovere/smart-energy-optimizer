import { computed } from 'vue'
import { useFetch } from 'nuxt/app'
import type { SiteApiItem } from '~~/shared/siteSchema'

export function useSitesList() {
  const { data, pending, error } = useFetch<SiteApiItem[]>('/api/sites')
  const sites = computed<SiteApiItem[]>(() => data.value ?? [])
  return { sites, pending, error }
}
