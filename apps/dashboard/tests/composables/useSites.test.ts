import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { StatsSummary, SiteId } from '../../app/types/api'
import { useSites } from '../../app/composables/useSites'

vi.mock('../../app/composables/useAlerts', () => ({
  useAlerts: () => ({
    alerts: ref([
      { alert_id: 'ALT-001', site_id: 'SITE002', severity: 'critical', type: 'outage',  message: 'Test', timestamp: new Date().toISOString() },
      { alert_id: 'ALT-002', site_id: 'SITE002', severity: 'high',     type: 'spike',   message: 'Test', timestamp: new Date().toISOString() },
    ]),
    pending: ref(false),
    error: ref(null),
  })
}))

vi.mock('../../app/composables/useSensorsStatus', () => {
  const famille = (family: string, status = 'ok') => ({ family, status, failing_until: null })
  const capteurs = (overall: string) => ({
    overall,
    sensors: ['consumption', 'electrical', 'temperature', 'humidity', 'network'].map(f => famille(f)),
  })
  return {
    useSensorsStatus: () => ({
      sensors: ref([
        { site_id: 'SITE001', site_name: 'Bureau Paris La Défense', ...capteurs('critical') },
        { site_id: 'SITE002', site_name: 'Usine Lyon Vénissieux', ...capteurs('degraded') },
        { site_id: 'SITE003', site_name: 'Data Center Marseille', ...capteurs('ok') },
      ]),
      pending: ref(false),
      error: ref(null),
    }),
  }
})

vi.mock('../../app/composables/useSitesList', () => ({
  useSitesList: () => ({
    sites: ref([
      { site_id: 'SITE001', site_name: 'Bureau Paris La Défense',  site_type: 'office',     location: 'Paris, France',     capacity_kw: 300,  status: 'active',      warning_threshold_kw: 240,  present_in_source: true },
      { site_id: 'SITE002', site_name: 'Usine Lyon Vénissieux',    site_type: 'factory',    location: 'Lyon, France',      capacity_kw: 1000, status: 'active',      warning_threshold_kw: 720,  present_in_source: true },
      { site_id: 'SITE003', site_name: 'Data Center Marseille',    site_type: 'datacenter', location: 'Marseille, France', capacity_kw: 800,  status: 'maintenance', warning_threshold_kw: null, present_in_source: true },
      { site_id: 'SITE004', site_name: 'Entrepôt Lille Seclin',    site_type: 'warehouse',  location: 'Lille, France',     capacity_kw: 450,  status: 'active',      warning_threshold_kw: 300,  present_in_source: true },
      { site_id: 'SITE005', site_name: 'Atelier Nantes Carquefou', site_type: 'factory',    location: 'Nantes, France',    capacity_kw: 600,  status: 'active',      warning_threshold_kw: 480,  present_in_source: true },
      { site_id: 'SITE006', site_name: 'Bureau Bordeaux Mérignac', site_type: 'office',     location: 'Bordeaux, France',  capacity_kw: 280,  status: 'active',      warning_threshold_kw: null, present_in_source: true },
      { site_id: 'SITE007', site_name: 'Laboratoire Grenoble',     site_type: 'lab',        location: 'Grenoble, France',  capacity_kw: 700,  status: 'active',      warning_threshold_kw: 560,  present_in_source: true },
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

describe('useSites', () => {
  it('returns all 7 sites', () => {
    const { sites } = useSites()
    expect(sites.value).toHaveLength(7)
  })

  it('each site has required fields', () => {
    const { sites } = useSites()
    for (const s of sites.value) {
      expect(s.site_id).toBeTruthy()
      expect(s.site_name).toBeTruthy()
      expect(s.capacity_kw).toBeGreaterThan(0)
      expect(['ok', 'degraded', 'critical']).toContain(s.health)
    }
  })

  it('getSite returns the matching site', () => {
    const { getSite } = useSites()
    const site = getSite('SITE001')
    expect(site).not.toBeNull()
    expect(site!.site_id).toBe('SITE001')
  })

  it('getSite returns null for unknown id', () => {
    const { getSite } = useSites()
    // @ts-expect-error expected wrong type
    expect(getSite('UNKNOWN')).toBeNull()
  })

  it('getSiteSensors returns 5 sensor families for a valid site', () => {
    const { getSiteSensors } = useSites()
    const sensors = getSiteSensors('SITE001')
    expect(sensors).toHaveLength(5)
  })

  it('getSiteSensors returns empty array for unknown site', () => {
    const { getSiteSensors } = useSites()
    // @ts-expect-error expected wrong type
    expect(getSiteSensors('UNKNOWN')).toEqual([])
  })

  it('getSiteAlerts returns only alerts for the given site', () => {
    const { getSiteAlerts } = useSites()
    const alerts = getSiteAlerts('SITE002')
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts.every(a => a.site_id === 'SITE002')).toBe(true)
  })

  it('getSiteAlerts returns empty array for a site with no alerts', () => {
    const { getSiteAlerts } = useSites()
    const alerts = getSiteAlerts('SITE006')
    expect(alerts).toEqual([])
  })

  it("getSiteHealth rend l'état global relevé par les capteurs", () => {
    const { getSiteHealth } = useSites()
    expect(getSiteHealth('SITE001')).toBe('critical')
    expect(getSiteHealth('SITE003')).toBe('ok')
  })

  it('SITE003 has null consumption', () => {
    const { getSite } = useSites()
    const site = getSite('SITE003')
    expect(site!.current_consumption_kw).toBeNull()
  })
})

describe('getSiteInfo', () => {
  it('returns site info with location for SITE001', () => {
    const { getSiteInfo } = useSites()
    const info = getSiteInfo('SITE001' as SiteId)
    expect(info).not.toBeNull()
    expect(info!.location).toBeTruthy()
    expect(info!.status).toBe('active')
    expect(info!.threshold_kw).toBe(240)
  })

  it('returns null for unknown id', () => {
    const { getSiteInfo } = useSites()
    // @ts-expect-error expected wrong type
    expect(getSiteInfo('UNKNOWN')).toBeNull()
  })
})

