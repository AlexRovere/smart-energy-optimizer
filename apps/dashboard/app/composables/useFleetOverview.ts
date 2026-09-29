import { ref, computed } from 'vue'
import type { AlertSeverity, CurrentReading, Reading, SensorHealth, SensorStatus, Site, SiteId, SiteType, SiteStatus } from '../types/api'
import { fmtNum, fmtPct } from '../utils/format'
import { useAlerts } from './useAlerts'
import { useFleetSummary } from './useFleetSummary'
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
    threshold_kw: item.warning_threshold_kw
  }
}


function mockSensors(): SensorStatus[] {
  const make = (id: SiteId, name: string, overall: SensorHealth): SensorStatus => ({
    site_id: id, site_name: name, overall,
    sensors: [
      { family: 'consumption', status: overall === 'critical' ? 'failing' : 'ok',       failing_until: null },
      { family: 'electrical',  status: overall === 'critical' ? 'failing' : overall,    failing_until: null },
      { family: 'temperature', status: overall === 'critical' ? 'critical' : 'ok',      failing_until: null },
      { family: 'humidity',    status: overall === 'degraded' ? 'degraded' : 'ok',      failing_until: null },
      { family: 'network',     status: overall === 'critical' ? 'failing' : 'ok',       failing_until: null },
    ],
  })
  return [
    make('SITE001', 'Bureau Paris La Défense',  'ok'),
    make('SITE002', 'Usine Lyon Vénissieux',    'degraded'),
    make('SITE003', 'Data Center Marseille',    'critical'),
    make('SITE004', 'Entrepôt Lille Seclin',    'ok'),
    make('SITE005', 'Atelier Nantes Carquefou', 'degraded'),
    make('SITE006', 'Bureau Bordeaux Mérignac', 'ok'),
    make('SITE007', 'Laboratoire Grenoble',     'ok'),
  ]
}


function mockCurrentReadings(): CurrentReading[] {
  const ts = '2026-09-15T11:40:00Z'
  return [
    { site_id: 'SITE001', site_type: 'office',     timestamp: ts, consumption_kw: 82.6,  consumption_kwh: 82.6,  voltage_v: 399.0, current_a: 119.2, power_factor: 0.907, temperature_celsius: 25.3, humidity_percent: 47.7, data_quality: 'good',     null_reasons: [] },
    { site_id: 'SITE002', site_type: 'factory',    timestamp: ts, consumption_kw: 571.65, consumption_kwh: 571.65, voltage_v: 402.1, current_a: 820.8, power_factor: 0.923, temperature_celsius: 28.1, humidity_percent: 62.3, data_quality: 'partial',  null_reasons: ['humidity_sensor_degraded'] },
    { site_id: 'SITE003', site_type: 'datacenter', timestamp: ts, consumption_kw: null,  consumption_kwh: null,  voltage_v: null,  current_a: null,  power_factor: null,  temperature_celsius: 22.1, humidity_percent: 45.0, data_quality: 'critical', null_reasons: ['consumption_sensor_offline', 'electrical_sensor_offline'] },
    { site_id: 'SITE004', site_type: 'warehouse',  timestamp: ts, consumption_kw: 85.22, consumption_kwh: 85.22, voltage_v: 400.4, current_a: 122.7, power_factor: 0.941, temperature_celsius: 18.4, humidity_percent: 55.2, data_quality: 'good',     null_reasons: [] },
    { site_id: 'SITE005', site_type: 'factory',    timestamp: ts, consumption_kw: 193.09, consumption_kwh: 193.09, voltage_v: 398.7, current_a: 278.2, power_factor: 0.888, temperature_celsius: 31.7, humidity_percent: 71.1, data_quality: 'degraded', null_reasons: ['humidity_sensor_degraded'] },
    { site_id: 'SITE006', site_type: 'office',     timestamp: ts, consumption_kw: 59.95, consumption_kwh: 59.95, voltage_v: 401.2, current_a: 86.2,  power_factor: 0.952, temperature_celsius: 23.8, humidity_percent: 44.1, data_quality: 'good',     null_reasons: [] },
    { site_id: 'SITE007', site_type: 'lab',        timestamp: ts, consumption_kw: 184.12, consumption_kwh: 184.12, voltage_v: 399.8, current_a: 265.0, power_factor: 0.889, temperature_celsius: 20.5, humidity_percent: 38.9, data_quality: 'good',     null_reasons: [] },
  ]
}

// Facteurs horaires déterministes sur 24h (index 0 = heure la plus ancienne)
const HOURLY_FACTORS = [0.30, 0.28, 0.26, 0.25, 0.27, 0.32, 0.45, 0.68, 0.82, 0.88, 0.90, 0.87, 0.82, 0.85, 0.88, 0.86, 0.80, 0.74, 0.66, 0.58, 0.50, 0.44, 0.38, 0.34]

function mockReadings(siteId: SiteId): Reading[] {
  const base = mockCurrentReadings().find(r => r.site_id === siteId)
  if (!base) return []
  const now = new Date('2026-09-15T11:40:00Z').getTime()
  return HOURLY_FACTORS.map((factor, i) => {
    const t = new Date(now - (23 - i) * 3_600_000).toISOString()
    const val = base.consumption_kw == null ? null : Math.round(base.consumption_kw * factor * 10) / 10
    return { ...base, timestamp: t, consumption_kw: val, consumption_kwh: val } as Reading
  })
}

export function useFleetOverview() {
  const { summary: stats, pending, refreshedAt, refreshFailed, refresh } = useFleetSummary()
  const { sites: rawSites } = useSitesList()
  const { alerts } = useAlerts()
  const sensors = ref<SensorStatus[]>(mockSensors())
  const siteDetails = computed<Site[]>(() => rawSites.value.map(siteApiItemToSite))
  const currentReadings = ref<CurrentReading[]>(mockCurrentReadings())

  function getReadingsForSite(id: SiteId): Reading[] {
    return mockReadings(id)
  }

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
    const siteTypeMap = new Map(siteDetails.value.map(s => [s.site_id, s.site_type]))
    return (stats.value?.sites ?? []).map(site => ({
      ...site,
      site_type: siteTypeMap.get(site.site_id),
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
    stats, alerts, sensors, siteDetails, currentReadings, pending,
    refreshedAt, refreshFailed, refresh,
    getReadingsForSite,
    totalConsumptionDisplay, totalCapacityDisplay, avgLoadDisplay, loadPercent,
    healthPercent, healthRatio, healthDisplay, healthNote, healthColor,
    activeAlertCount, criticalCount, alertNote, alertNoteTone,
    siteSummary, sitesOkCount, sitesDegradedCount, sitesCriticalCount,
    alertsByLevel, recentAlerts,
    hasIncompleteData, excludedSites
  }
}
