import { describe, expect, it } from 'vitest'
import { useSettings } from '~/composables/useSettings'

describe('useSettings', () => {
  describe('rôle actif (RBAC)', () => {
    it('le rôle par défaut est admin', () => {
      const { activeRole } = useSettings()
      expect(activeRole.value).toBe('admin')
    })

    it('admin a 3 capacités', () => {
      const { activeRole, roleCapabilities } = useSettings()
      activeRole.value = 'admin'
      expect(roleCapabilities.value).toHaveLength(3)
    })

    it('operator a 2 capacités', () => {
      const { activeRole, roleCapabilities } = useSettings()
      activeRole.value = 'operator'
      expect(roleCapabilities.value).toHaveLength(2)
    })

    it('viewer a 1 capacité', () => {
      const { activeRole, roleCapabilities } = useSettings()
      activeRole.value = 'viewer'
      expect(roleCapabilities.value).toHaveLength(1)
    })

    it('changer le rôle met à jour les capacités', () => {
      const { activeRole, roleCapabilities } = useSettings()
      activeRole.value = 'viewer'
      const viewerCount = roleCapabilities.value.length
      activeRole.value = 'admin'
      expect(roleCapabilities.value.length).toBeGreaterThan(viewerCount)
    })
  })

  describe('seuils par site', () => {
    it('retourne 3 entrées de sites', () => {
      const { siteThresholds } = useSettings()
      expect(siteThresholds.value).toHaveLength(3)
    })

    it('chaque entrée a les champs requis', () => {
      const { siteThresholds } = useSettings()
      for (const entry of siteThresholds.value) {
        expect(entry.site_id).toBeTruthy()
        expect(entry.site_name).toBeTruthy()
        expect(entry.capacity_kw).toBeGreaterThan(0)
        expect(entry.threshold_kw).toBeGreaterThan(0)
        expect(['enregistré', 'modifié']).toContain(entry.state)
      }
    })

    it('état initial de tous les sites est enregistré', () => {
      const { siteThresholds } = useSettings()
      for (const entry of siteThresholds.value) {
        expect(entry.state).toBe('enregistré')
      }
    })

    it('updateThreshold change la valeur et passe l\'état à modifié', () => {
      const { siteThresholds, updateThreshold } = useSettings()
      const firstSiteId = siteThresholds.value[0]?.site_id ?? 'SITE001'
      updateThreshold(firstSiteId, 999)
      const updated = siteThresholds.value.find(e => e.site_id === firstSiteId)!
      expect(updated.threshold_kw).toBe(999)
      expect(updated.state).toBe('modifié')
    })

    it('les autres sites ne sont pas affectés par updateThreshold', () => {
      const { siteThresholds, updateThreshold } = useSettings()
      const firstSiteId = siteThresholds.value[0]?.site_id ?? 'SITE001'
      updateThreshold(firstSiteId, 999)
      const others = siteThresholds.value.filter(e => e.site_id !== firstSiteId)
      for (const entry of others) {
        expect(entry.state).toBe('enregistré')
      }
    })

    it('resetThresholds restaure toutes les valeurs et états', () => {
      const { siteThresholds, updateThreshold, resetThresholds } = useSettings()
      const firstSiteId = siteThresholds.value[0]?.site_id ?? 'SITE001'
      const originalValue = siteThresholds.value[0]?.threshold_kw ?? 0
      updateThreshold(firstSiteId, 999)
      resetThresholds()
      const reset = siteThresholds.value.find(e => e.site_id === firstSiteId)!
      expect(reset.threshold_kw).toBe(originalValue)
      expect(reset.state).toBe('enregistré')
    })

    it('saveThresholds passe tous les états à enregistré sans changer les valeurs', () => {
      const { siteThresholds, updateThreshold, saveThresholds } = useSettings()
      const firstSiteId = siteThresholds.value[0]?.site_id ?? 'SITE001'
      updateThreshold(firstSiteId, 123)
      saveThresholds()
      const saved = siteThresholds.value.find(e => e.site_id === firstSiteId)!
      expect(saved.threshold_kw).toBe(123)
      expect(saved.state).toBe('enregistré')
    })

    it('capacityPercent retourne threshold / capacity * 100 arrondi', () => {
      const { siteThresholds, capacityPercent } = useSettings()
      const entry = siteThresholds.value[0]
      if (!entry) return
      const expected = Math.round(entry.threshold_kw / entry.capacity_kw * 100)
      expect(capacityPercent(entry)).toBe(expected)
    })

    it('hasUnsavedChanges est false par défaut', () => {
      const { hasUnsavedChanges } = useSettings()
      expect(hasUnsavedChanges.value).toBe(false)
    })

    it('hasUnsavedChanges est true après updateThreshold', () => {
      const { siteThresholds, updateThreshold, hasUnsavedChanges } = useSettings()
      updateThreshold(siteThresholds.value[0]?.site_id ?? 'SITE001', 1)
      expect(hasUnsavedChanges.value).toBe(true)
    })

    it('hasUnsavedChanges revient à false après saveThresholds', () => {
      const { siteThresholds, updateThreshold, saveThresholds, hasUnsavedChanges } = useSettings()
      updateThreshold(siteThresholds.value[0]?.site_id ?? 'SITE001', 1)
      saveThresholds()
      expect(hasUnsavedChanges.value).toBe(false)
    })

    it('hasUnsavedChanges revient à false après resetThresholds', () => {
      const { siteThresholds, updateThreshold, resetThresholds, hasUnsavedChanges } = useSettings()
      updateThreshold(siteThresholds.value[0]?.site_id ?? 'SITE001', 1)
      resetThresholds()
      expect(hasUnsavedChanges.value).toBe(false)
    })
  })

  describe('notifications', () => {
    it('critical_alerts est activé par défaut', () => {
      const { notifications } = useSettings()
      expect(notifications.value.critical_alerts).toBe(true)
    })

    it('daily_summary est activé par défaut', () => {
      const { notifications } = useSettings()
      expect(notifications.value.daily_summary).toBe(true)
    })

    it('sensor_fault est désactivé par défaut', () => {
      const { notifications } = useSettings()
      expect(notifications.value.sensor_fault).toBe(false)
    })

    it('updateNotification modifie la valeur correspondante', () => {
      const { notifications, updateNotification } = useSettings()
      updateNotification('critical_alerts', false)
      expect(notifications.value.critical_alerts).toBe(false)
    })

    it('updateNotification ne modifie pas les autres valeurs', () => {
      const { notifications, updateNotification } = useSettings()
      updateNotification('sensor_fault', true)
      expect(notifications.value.critical_alerts).toBe(true)
      expect(notifications.value.daily_summary).toBe(true)
    })
  })

  describe('session', () => {
    it('session.user_name est défini', () => {
      const { session } = useSettings()
      expect(session.value.user_name).toBeTruthy()
    })

    it('session.role est défini', () => {
      const { session } = useSettings()
      expect(session.value.role).toBeTruthy()
    })

    it('session.polling_interval_s est un entier positif', () => {
      const { session } = useSettings()
      expect(session.value.polling_interval_s).toBeGreaterThan(0)
      expect(Number.isInteger(session.value.polling_interval_s)).toBe(true)
    })

    it('session.health_label est défini', () => {
      const { session } = useSettings()
      expect(session.value.health_label).toBeTruthy()
    })
  })
})
