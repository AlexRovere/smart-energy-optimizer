import { useFetch } from 'nuxt/app'
import { computed } from 'vue'
import type { ParkSummary } from '~~/shared/parkSummarySchema'
import type { StatsSummary, SiteId } from '../types/api'

function normaliser(raw: ParkSummary): StatsSummary {
  return {
    timestamp: raw.timestamp,
    total_consumption_kw: raw.total_consumption_kw,
    total_capacity_kw: raw.total_capacity_kw,
    avg_load_pct: raw.average_load_percent,
    sites_total: raw.total_sites,
    sites_counted: raw.total_sites - raw.excluded_sites.length,
    excluded_sites: raw.excluded_sites as SiteId[],
    sites: raw.sites as StatsSummary['sites']
  }
}

export function useFleetSummary() {
  const { data, pending, error } = useFetch<ParkSummary>('/api/stats/summary')
  const summary = computed<StatsSummary | null>(() =>
    data.value ? normaliser(data.value) : null
  )
  return { summary, pending, error }
}
