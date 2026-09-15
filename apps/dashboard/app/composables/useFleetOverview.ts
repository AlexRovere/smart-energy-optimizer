import type { Alert, AlertSeverity, SensorHealth, SensorStatus, SiteId, StatsSummary } from '../types/api'
import { fmtNum, fmtPct } from '../utils/format'

function mockStats(): StatsSummary {
  return {
    timestamp: '2026-09-15T22:00:00Z',
    total_consumption_kw: 1166,
    total_capacity_kw: 4130,
    avg_load_pct: 35.0,
    sites_counted: 6,
    sites_total: 7,
    excluded_sites: ['SITE003'],
    sites: [
      { site_id: 'SITE001', site_name: 'Bureau Paris La Défense',  site_type: 'office',     current_consumption_kw: 71.95,  capacity_kw: 300,  load_percent: 24.0, data_quality: 'good'     },
      { site_id: 'SITE002', site_name: 'Usine Lyon Vénissieux',    site_type: 'factory',    current_consumption_kw: 571.65, capacity_kw: 1000, load_percent: 57.2, data_quality: 'partial'  },
      { site_id: 'SITE003', site_name: 'Data Center Marseille',    site_type: 'datacenter', current_consumption_kw: null,   capacity_kw: 800,  load_percent: null, data_quality: 'critical' },
      { site_id: 'SITE004', site_name: 'Entrepôt Lille Seclin',    site_type: 'warehouse',  current_consumption_kw: 85.22,  capacity_kw: 450,  load_percent: 18.9, data_quality: 'good'     },
      { site_id: 'SITE005', site_name: 'Atelier Nantes Carquefou', site_type: 'factory',    current_consumption_kw: 193.09, capacity_kw: 600,  load_percent: 32.2, data_quality: 'degraded' },
      { site_id: 'SITE006', site_name: 'Bureau Bordeaux Mérignac', site_type: 'office',     current_consumption_kw: 59.95,  capacity_kw: 280,  load_percent: 21.4, data_quality: 'good'     },
      { site_id: 'SITE007', site_name: 'Laboratoire Grenoble',     site_type: 'lab',        current_consumption_kw: 184.12, capacity_kw: 700,  load_percent: 26.3, data_quality: 'good'     },
    ],
  }
}

function mockAlerts(): Alert[] {
  const now = Date.now()
  return [
    { alert_id: 'ALT-001', site_id: 'SITE003', severity: 'critical', type: 'outage',    message: 'Capteur de consommation muet depuis 12 min',      timestamp: new Date(now - 12  * 60_000).toISOString() },
    { alert_id: 'ALT-002', site_id: 'SITE002', severity: 'critical', type: 'threshold', message: 'Seuil dépassé sur la ligne principale',             timestamp: new Date(now - 27  * 60_000).toISOString(), value: 781,  threshold: 720  },
    { alert_id: 'ALT-003', site_id: 'SITE005', severity: 'high',     type: 'spike',     message: 'Pic de charge +34 % en 5 min',                     timestamp: new Date(now - 48  * 60_000).toISOString(), value: 402,  threshold: 480  },
    { alert_id: 'ALT-004', site_id: 'SITE002', severity: 'medium',   type: 'sensor',    message: 'Hygromètre hors plage — mesure écartée',           timestamp: new Date(now - 96  * 60_000).toISOString() },
    { alert_id: 'ALT-005', site_id: 'SITE007', severity: 'low',      type: 'anomaly',   message: 'Facteur de puissance en baisse continue',           timestamp: new Date(now - 184 * 60_000).toISOString(), value: 0.89, threshold: 0.92 },
  ]
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

export function useFleetOverview() {
  const stats = ref<StatsSummary | null>(mockStats())
  const alerts = ref<Alert[]>(mockAlerts())
  const sensors = ref<SensorStatus[]>(mockSensors())
  const pending = ref(false)

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
    return (stats.value?.sites ?? []).map(site => ({
      ...site,
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
    for (const a of alerts.value) counts[a.severity]++
    return counts
  })

  const recentAlerts = computed(() =>
    [...alerts.value]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 5),
  )

  // -- Incomplete data -----------------------------------------

  const hasIncompleteData = computed(() =>
    (stats.value?.excluded_sites.length ?? 0) > 0,
  )

  const excludedSites = computed<SiteId[]>(() =>
    stats.value?.excluded_sites ?? [],
  )

  return {
    stats, alerts, sensors, pending,
    totalConsumptionDisplay, totalCapacityDisplay, avgLoadDisplay, loadPercent,
    healthPercent, healthRatio, healthDisplay, healthNote, healthColor,
    activeAlertCount, criticalCount, alertNote, alertNoteTone,
    siteSummary, sitesOkCount, sitesDegradedCount, sitesCriticalCount,
    alertsByLevel, recentAlerts,
    hasIncompleteData, excludedSites
  }
}
