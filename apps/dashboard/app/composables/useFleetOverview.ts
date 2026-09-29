import { computed } from 'vue'
import type { AlertSeverity, SensorHealth, Site, SiteId, SiteType, SiteStatus } from '../types/api'
import { fmtNum, fmtPct } from '../utils/format'
import { useAlerts } from './useAlerts'
import { useFleetSummary } from './useFleetSummary'
import { useSensorsStatus } from './useSensorsStatus'
import { useSitesList } from './useSitesList'
import type { SiteApiItem } from '~~/shared/siteSchema'

function siteApiItemToSite(item: SiteApiItem): Site {
  return {
    site_id: item.site_id as SiteId,
    site_name: item.site_name,
    site_type: item.site_type as SiteType,
    location: item.location ?? '',
    capacity_kw: item.capacity_kw,
    status: item.status as SiteStatus,
    threshold_kw: item.warning_threshold_kw,
    first_data_at: item.first_data_at ?? null,
    last_data_at: item.last_data_at ?? null
  }
}


export function useFleetOverview() {
  const { summary: stats, pending, refreshedAt, refreshFailed, refresh } = useFleetSummary()
  const { sites: rawSites } = useSitesList()
  const { alerts } = useAlerts()
  const { sensors } = useSensorsStatus()
  const siteDetails = computed<Site[]>(() => rawSites.value.map(siteApiItemToSite))

  // -- KPI computeds -----------------------------------------

  const totalConsumptionDisplay = computed(() =>
    fmtNum(stats.value?.total_consumption_kw),
  )

  const totalCapacityDisplay = computed(() => 
    fmtNum(stats.value?.total_capacity_kw)
  )

  const avgLoadDisplay = computed(() => {
    const v = stats.value?.avg_load_pct
    if (v == null) return '--'
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  })

  const loadPercent = computed(() => stats.value?.avg_load_pct ?? null)

  // -- Sensor health -----------------------------------------

  const sensorCounts = computed(() => {
    let ok = 0, total = 0
    for (const site of sensors.value) {
      for (const s of site.sensors) {
        total++
        if (s.status === 'ok') ok++
      }
    }
    return { ok, total }
  })

  const healthPercent = computed(() => {
    const { ok, total } = sensorCounts.value
    return total === 0 ? null : (ok / total) * 100
  })

  const healthRatio = computed(() => {
    const pct = healthPercent.value
    return pct == null ? null : pct / 100
  })

  const healthDisplay = computed(() => fmtPct(healthPercent.value))

  const healthNote = computed(() => {
    const { ok, total } = sensorCounts.value
    return `${ok}/${total} capteurs ok`
  })

  const healthColor = computed(() => {
    const pct = healthPercent.value
    if (pct == null) return 'var(--ev-green)'
    if (pct >= 80) return 'var(--ev-green)'
    if (pct >= 50) return 'var(--ev-amber)'
    return 'var(--ev-red)'
  })

  // -- Sites table -----------------------------------------

  const siteSummary = computed(() => {
    const sensorMap = new Map(sensors.value.map(s => [s.site_id, s.overall]))
    const detailMap = new Map(siteDetails.value.map(s => [s.site_id, s]))
    return (stats.value?.sites ?? []).map(site => ({
      ...site,
      site_type: detailMap.get(site.site_id)?.site_type,
      last_data_at: detailMap.get(site.site_id)?.last_data_at ?? null,
      health: (sensorMap.get(site.site_id) ?? 'ok') as SensorHealth
    }))
  })

  const sitesOkCount = computed(() => siteSummary.value.filter(s => s.health === 'ok').length)
  const sitesDegradedCount = computed(() => siteSummary.value.filter(s => s.health === 'degraded').length)
  const sitesCriticalCount = computed(() => siteSummary.value.filter(s => s.health === 'critical').length)

  // -- Alerts -----------------------------------------

  const activeAlertCount = computed(() => String(alerts.value.length))

  const criticalCount = computed(() =>
    alerts.value.filter(a => a.severity === 'critical').length,
  )

  const alertNote = computed(() =>
    criticalCount.value > 0
      ? `dont ${criticalCount.value} critiques`
      : 'Aucune alerte critique',
  )

  const alertNoteTone = computed<'muted' | 'amber'>(() =>
    criticalCount.value > 0 ? 'amber' : 'muted',
  )

  const alertsByLevel = computed(() => {
    const counts: Record<AlertSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const a of alerts.value) {
      if (a.severity in counts) counts[a.severity as AlertSeverity]++
    }
    return counts
  })

  const recentAlerts = computed(() =>
    [...alerts.value]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 5),
  )

  // -- Incomplete data -----------------------------------------

  const hasIncompleteData = computed(() =>
    (stats.value?.excluded_sites?.length ?? 0) > 0,
  )

  const excludedSites = computed<SiteId[]>(() =>
    stats.value?.excluded_sites ?? [],
  )

  return {
    stats, alerts, sensors, siteDetails, pending,
    refreshedAt, refreshFailed, refresh,
    totalConsumptionDisplay, totalCapacityDisplay, avgLoadDisplay, loadPercent,
    healthPercent, healthRatio, healthDisplay, healthNote, healthColor,
    activeAlertCount, criticalCount, alertNote, alertNoteTone,
    siteSummary, sitesOkCount, sitesDegradedCount, sitesCriticalCount,
    alertsByLevel, recentAlerts,
    hasIncompleteData, excludedSites
  }
}
