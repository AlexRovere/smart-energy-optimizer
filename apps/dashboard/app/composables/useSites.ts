import { computed } from 'vue'
import type { Alert, SensorHealth, SensorStatus, Site, SiteId } from '~/types/api'
import { useFleetOverview } from '../composables/useFleetOverview'

export function useSites() {
  const { siteSummary, sensors, alerts, siteDetails } = useFleetOverview()

  const sites = computed(() => siteSummary.value)

  function getSite(id: SiteId) {
    return sites.value.find(s => s.site_id === id) ?? null
  }

  function getSiteSensors(id: SiteId): SensorStatus['sensors'] {
    return sensors.value.find(s => s.site_id === id)?.sensors ?? []
  }

  function getSiteAlerts(id: SiteId): Alert[] {
    return alerts.value.filter(a => a.site_id === id)
  }

  function getSiteHealth(id: SiteId): SensorHealth {
    return sensors.value.find(s => s.site_id === id)?.overall ?? 'ok'
  }

  function getSiteInfo(id: SiteId): Site | null {
    return siteDetails.value.find(s => s.site_id === id) ?? null
  }



  return {
    sites,
    getSite,
    getSiteSensors,
    getSiteAlerts,
    getSiteHealth,
    getSiteInfo,
  }
}
