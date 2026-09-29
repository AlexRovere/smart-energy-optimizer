import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { Alert, StatsSummary } from '../../app/types/api'
import { useFleetOverview } from '../../app/composables/useFleetOverview'

const alertesFixture: Alert[] = [
  { alert_id: 'ALT-001', site_id: 'SITE003', severity: 'critical', type: 'outage',    message: 'Capteur muet',    timestamp: new Date(Date.now() - 12 * 60_000).toISOString() },
  { alert_id: 'ALT-002', site_id: 'SITE002', severity: 'critical', type: 'threshold', message: 'Seuil dépassé',   timestamp: new Date(Date.now() - 27 * 60_000).toISOString(), value: 781, threshold: 720 },
  { alert_id: 'ALT-003', site_id: 'SITE005', severity: 'high',     type: 'spike',     message: 'Pic de charge',   timestamp: new Date(Date.now() - 48 * 60_000).toISOString() },
  { alert_id: 'ALT-004', site_id: 'SITE002', severity: 'medium',   type: 'sensor',    message: 'Hygromètre KO',   timestamp: new Date(Date.now() - 96 * 60_000).toISOString() },
  { alert_id: 'ALT-005', site_id: 'SITE007', severity: 'low',      type: 'anomaly',   message: 'Facteur baisse',  timestamp: new Date(Date.now() - 184 * 60_000).toISOString() },
]

vi.mock('../../app/composables/useAlerts', () => ({
  useAlerts: () => ({
    alerts: computed(() => alertesFixture),
    pending: ref(false),
    error: ref(null),
  }),
}))

vi.mock('../../app/composables/useSensorsStatus', async () =>
  (await import('../fixtures/sensorsStatus')).sensorsStatusModule)

vi.mock('../../app/composables/useSitesList', () => ({
  useSitesList: () => ({
    sites: ref([
      { site_id: 'SITE001', site_name: 'Bureau Paris La Défense', site_type: 'office', location: null, capacity_kw: 300, status: 'active', warning_threshold_kw: null, present_in_source: true, last_data_at: '2026-09-29T13:00:00.000Z' },
    ]),
    pending: ref(false),
    error: ref(null)
  })
}))

vi.mock('../../app/composables/useFleetSummary', () => ({
  useFleetSummary: () => ({
    summary: ref<StatsSummary>({
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
      ]
    }),
    pending: ref(false),
    error: ref(null)
  })
}))

describe('useFleetOverview', () => {
  it('returns stats with valid StatsSummary shape', () => {
    const { stats } = useFleetOverview()
    expect(stats.value).not.toBeNull()
    expect(stats.value!.total_capacity_kw).toBeGreaterThan(0)
    expect(stats.value!.sites).toHaveLength(7)
    expect(stats.value!.sites_total).toBe(7)
  })

  it('has excluded sites with null consumption', () => {
    const { stats } = useFleetOverview()
    const s = stats.value!
    expect(s.excluded_sites.length).toBeGreaterThan(0)
    for (const id of s.excluded_sites) {
      const site = s.sites.find(si => si.site_id === id)
      expect(site?.current_consumption_kw).toBeNull()
    }
  })

  it('computes totalConsumptionDisplay as a non-empty string', () => {
    const { totalConsumptionDisplay } = useFleetOverview()
    expect(totalConsumptionDisplay.value).not.toBe('--')
    expect(totalConsumptionDisplay.value.length).toBeGreaterThan(0)
  })

  it('computes loadPercent as a number between 0 and 100', () => {
    const { loadPercent } = useFleetOverview()
    expect(loadPercent.value).toBeGreaterThanOrEqual(0)
    expect(loadPercent.value).toBeLessThanOrEqual(100)
  })

  it('returns alerts as a non-empty array', () => {
    const { alerts } = useFleetOverview()
    expect(alerts.value.length).toBeGreaterThan(0)
  })

  it('computes activeAlertCount matching alerts length', () => {
    const { alerts, activeAlertCount } = useFleetOverview()
    expect(activeAlertCount.value).toBe(String(alerts.value.length))
  })

  it('computes criticalCount from alerts', () => {
    const { alerts, criticalCount } = useFleetOverview()
    const expected = alerts.value.filter(a => a.severity === 'critical').length
    expect(criticalCount.value).toBe(expected)
  })

  it('sets alertNoteTone to amber when critical alerts exist', () => {
    const { criticalCount, alertNoteTone } = useFleetOverview()
    if (criticalCount.value > 0) {
      expect(alertNoteTone.value).toBe('amber')
    } else {
      expect(alertNoteTone.value).toBe('muted')
    }
  })

  it('returns sensors as a non-empty array', () => {
    const { sensors } = useFleetOverview()
    expect(sensors.value.length).toBeGreaterThan(0)
  })

  it('computes healthPercent between 0 and 100', () => {
    const { healthPercent } = useFleetOverview()
    expect(healthPercent.value).not.toBeNull()
    expect(healthPercent.value!).toBeGreaterThanOrEqual(0)
    expect(healthPercent.value!).toBeLessThanOrEqual(100)
  })

  it('computes healthRatio between 0 and 1', () => {
    const { healthRatio } = useFleetOverview()
    expect(healthRatio.value).not.toBeNull()
    expect(healthRatio.value!).toBeGreaterThanOrEqual(0)
    expect(healthRatio.value!).toBeLessThanOrEqual(1)
  })

  it('computes healthNote with ok/total format', () => {
    const { healthNote } = useFleetOverview()
    expect(healthNote.value).toMatch(/\d+\/\d+ capteurs ok/)
  })

  it('computes healthColor as a CSS variable', () => {
    const { healthColor } = useFleetOverview()
    expect(healthColor.value).toMatch(/^var\(--ev-(green|amber|red)\)$/)
  })

  it('returns recentAlerts sorted by timestamp desc, max 5', () => {
    const { recentAlerts } = useFleetOverview()
    expect(recentAlerts.value.length).toBeLessThanOrEqual(5)
    for (let i = 1; i < recentAlerts.value.length; i++) {
      expect(recentAlerts.value[i - 1]!.timestamp >= recentAlerts.value[i]!.timestamp).toBe(true)
    }
  })

  it('exposes hasIncompleteData based on excluded_sites', () => {
    const { hasIncompleteData, excludedSites } = useFleetOverview()
    expect(hasIncompleteData.value).toBe(excludedSites.value.length > 0)
  })

  it('is not pending', () => {
    const { pending } = useFleetOverview()
    expect(pending.value).toBe(false)
  })

  it("tire la santé de chaque site de l'état réel des capteurs", () => {
    const { siteSummary } = useFleetOverview()
    const santé = Object.fromEntries(siteSummary.value.map(s => [s.site_id, s.health]))
    expect(santé).toMatchObject({ SITE001: 'critical', SITE002: 'degraded', SITE003: 'ok' })
  })

  it('reporte la date de la dernière donnée de chaque site', () => {
    const { siteSummary } = useFleetOverview()
    expect(siteSummary.value.find(s => s.site_id === 'SITE001')?.last_data_at).toBe('2026-09-29T13:00:00.000Z')
    expect(siteSummary.value.find(s => s.site_id === 'SITE002')?.last_data_at).toBeNull()
  })
})
