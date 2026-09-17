import { describe, expect, it } from 'vitest'
import { useFleetOverview } from '../../app/composables/useFleetOverview'

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
})
