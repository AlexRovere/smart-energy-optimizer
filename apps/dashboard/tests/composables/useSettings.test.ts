import { describe, expect, it } from 'vitest'
import { useSettings } from '../../app/composables/useSettings'

describe('useSettings', () => {
  describe('rôle actif (RBAC)', () => {
    it('le rôle par défaut est admin', () => {
      const { activeRole } = useSettings()
      expect(activeRole.value).toBe('admin')
    })

    it.each([
      ['admin', 3],
      ['operator', 2],
      ['viewer', 1],
    ] as const)('%s a %i capacités', (role, nombreDeCapacités) => {
      const { activeRole, roleCapabilities } = useSettings()
      activeRole.value = role
      expect(roleCapabilities.value).toHaveLength(nombreDeCapacités)
    })

    it('changer le rôle met à jour les capacités', () => {
      const { activeRole, roleCapabilities } = useSettings()
      activeRole.value = 'viewer'
      const viewerCount = roleCapabilities.value.length
      activeRole.value = 'admin'
      expect(roleCapabilities.value.length).toBeGreaterThan(viewerCount)
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
})
