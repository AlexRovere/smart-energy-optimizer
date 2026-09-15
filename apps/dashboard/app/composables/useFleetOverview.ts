import type { Alert, SensorStatus, SiteId, StatsSummary } from '../types/api'
import { fmtNum, fmtPct } from '../utils/format'

function mockStats(): StatsSummary {
  return {
    timestamp: '2026-09-15T10:30:00Z',
    total_consumption_kw: 1284,
    total_capacity_kw: 2700,
    avg_load_pct: 47.6,
    sites_counted: 5,
    sites_total: 7,
    excluded_sites: ['SITE003', 'SITE006'],
    sites: [
      { site_id: 'SITE001', site_name: 'Siège Lyon', current_consumption_kw: 312, capacity_kw: 400, load_percent: 78, data_quality: 'good' },
      { site_id: 'SITE002', site_name: 'Usine Grenoble', current_consumption_kw: 487, capacity_kw: 600, load_percent: 81.2, data_quality: 'good' },
      { site_id: 'SITE003', site_name: 'DC Paris-Saclay', current_consumption_kw: null, capacity_kw: 1000, load_percent: null, data_quality: 'critical' },
      { site_id: 'SITE004', site_name: 'Bureau Nantes', current_consumption_kw: 145, capacity_kw: 200, load_percent: 72.5, data_quality: 'good' },
      { site_id: 'SITE005', site_name: 'Entrepôt Marseille', current_consumption_kw: 340, capacity_kw: 500, load_percent: 68, data_quality: 'partial' },
      { site_id: 'SITE006', site_name: 'Labo Toulouse', current_consumption_kw: null, capacity_kw: 300, load_percent: null, data_quality: 'degraded' },
      { site_id: 'SITE007', site_name: 'Atelier Bordeaux', current_consumption_kw: 0, capacity_kw: 200, load_percent: 0, data_quality: 'good' },
    ],
  }
}

function mockAlerts(): Alert[] {
  const now = Date.now()
  return [
    { alert_id: 'ALT-001', site_id: 'SITE003', severity: 'critical', type: 'outage', message: 'Perte de communication avec le site DC Paris-Saclay', timestamp: new Date(now - 12 * 60_000).toISOString() },
    { alert_id: 'ALT-002', site_id: 'SITE002', severity: 'high', type: 'spike', message: 'Pic de consommation détecté — 487 kW (seuil : 450 kW)', timestamp: new Date(now - 25 * 60_000).toISOString(), value: 487, threshold: 450 },
    { alert_id: 'ALT-003', site_id: 'SITE006', severity: 'medium', type: 'sensor', message: 'Capteur température dégradé sur Labo Toulouse', timestamp: new Date(now - 42 * 60_000).toISOString() },
    { alert_id: 'ALT-004', site_id: 'SITE005', severity: 'low', type: 'threshold', message: 'Consommation proche du seuil d\'alerte', timestamp: new Date(now - 55 * 60_000).toISOString(), value: 340, threshold: 380 },
    { alert_id: 'ALT-005', site_id: 'SITE001', severity: 'critical', type: 'anomaly', message: 'Anomalie facteur de puissance détectée — valeur hors plage', timestamp: new Date(now - 8 * 60_000).toISOString() },
  ]
}

function mockSensors(): SensorStatus[] {
  return [
    { site_id: 'SITE001', site_name: 'Siège Lyon', overall: 'ok', sensors: [
      { family: 'consumption', status: 'ok', failing_until: null },
      { family: 'electrical', status: 'ok', failing_until: null },
      { family: 'temperature', status: 'ok', failing_until: null },
      { family: 'humidity', status: 'ok', failing_until: null },
      { family: 'network', status: 'ok', failing_until: null },
    ] },
    { site_id: 'SITE002', site_name: 'Usine Grenoble', overall: 'ok', sensors: [
      { family: 'consumption', status: 'ok', failing_until: null },
      { family: 'electrical', status: 'ok', failing_until: null },
      { family: 'temperature', status: 'ok', failing_until: null },
      { family: 'humidity', status: 'degraded', failing_until: null },
      { family: 'network', status: 'ok', failing_until: null },
    ] },
    { site_id: 'SITE003', site_name: 'DC Paris-Saclay', overall: 'critical', sensors: [
      { family: 'consumption', status: 'failing', failing_until: '2026-09-15T12:00:00Z' },
      { family: 'electrical', status: 'failing', failing_until: '2026-09-15T12:00:00Z' },
      { family: 'temperature', status: 'critical', failing_until: null },
      { family: 'humidity', status: 'critical', failing_until: null },
      { family: 'network', status: 'failing', failing_until: '2026-09-15T12:00:00Z' },
    ] },
    { site_id: 'SITE004', site_name: 'Bureau Nantes', overall: 'ok', sensors: [
      { family: 'consumption', status: 'ok', failing_until: null },
      { family: 'electrical', status: 'ok', failing_until: null },
      { family: 'temperature', status: 'ok', failing_until: null },
      { family: 'humidity', status: 'ok', failing_until: null },
      { family: 'network', status: 'ok', failing_until: null },
    ] },
    { site_id: 'SITE005', site_name: 'Entrepôt Marseille', overall: 'ok', sensors: [
      { family: 'consumption', status: 'ok', failing_until: null },
      { family: 'electrical', status: 'ok', failing_until: null },
      { family: 'temperature', status: 'ok', failing_until: null },
      { family: 'humidity', status: 'ok', failing_until: null },
      { family: 'network', status: 'degraded', failing_until: null },
    ] },
    { site_id: 'SITE006', site_name: 'Labo Toulouse', overall: 'degraded', sensors: [
      { family: 'consumption', status: 'ok', failing_until: null },
      { family: 'electrical', status: 'degraded', failing_until: null },
      { family: 'temperature', status: 'degraded', failing_until: null },
      { family: 'humidity', status: 'ok', failing_until: null },
      { family: 'network', status: 'ok', failing_until: null },
    ] },
    { site_id: 'SITE007', site_name: 'Atelier Bordeaux', overall: 'ok', sensors: [
      { family: 'consumption', status: 'ok', failing_until: null },
      { family: 'electrical', status: 'ok', failing_until: null },
      { family: 'temperature', status: 'ok', failing_until: null },
      { family: 'humidity', status: 'ok', failing_until: null },
      { family: 'network', status: 'ok', failing_until: null },
    ] },
  ]
}

export function useFleetOverview() {
  const stats = ref<StatsSummary | null>(mockStats())
  const alerts = ref<Alert[]>(mockAlerts())
  const sensors = ref<SensorStatus[]>(mockSensors())
  const pending = ref(false)

  const totalConsumptionDisplay = computed(() =>
    fmtNum(stats.value?.total_consumption_kw),
  )

  const loadPercent = computed(() =>
    stats.value?.avg_load_pct ?? null,
  )

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

  const sensorCounts = computed(() => {
    let ok = 0
    let total = 0
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

  const hasIncompleteData = computed(() =>
    (stats.value?.excluded_sites.length ?? 0) > 0,
  )

  const excludedSites = computed<SiteId[]>(() =>
    stats.value?.excluded_sites ?? [],
  )

  const recentAlerts = computed(() =>
    [...alerts.value]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 5),
  )

  return {
    stats,
    alerts,
    sensors,
    pending,
    totalConsumptionDisplay,
    loadPercent,
    activeAlertCount,
    criticalCount,
    alertNote,
    alertNoteTone,
    healthPercent,
    healthRatio,
    healthDisplay,
    healthNote,
    healthColor,
    hasIncompleteData,
    excludedSites,
    recentAlerts,
  }
}
