import type { Alert, CurrentReading, Reading, SensorHealth, SensorStatus, Site, SiteId } from '~/types/api'

export function useSites() {
  const { siteSummary, sensors, alerts, siteDetails, currentReadings, getReadingsForSite } = useFleetOverview()

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

  function getCurrentReading(id: SiteId): CurrentReading | null {
    return currentReadings.value.find(r => r.site_id === id) ?? null
  }

  function getReadings(id: SiteId): Reading[] {
    return getReadingsForSite(id)
  }

  return {
    sites,
    getSite,
    getSiteSensors,
    getSiteAlerts,
    getSiteHealth,
    getSiteInfo,
    getCurrentReading,
    getReadings,
  }
}
