import { computed, ref } from 'vue'
import type { NotificationPreferences } from '~/types/api'

type Role = 'admin' | 'operator' | 'viewer'

const ROLE_CAPABILITIES: Record<Role, string[]> = {
  admin: ['lecture', 'écriture', 'administration'],
  operator: ['lecture', 'écriture'],
  viewer: ['lecture'],
}

function mockNotifications(): NotificationPreferences {
  return { critical_alerts: true, daily_summary: true, sensor_fault: false }
}

export function useSettings() {
  const activeRole = ref<Role>('admin')
  const roleCapabilities = computed(() => ROLE_CAPABILITIES[activeRole.value])

  const notifications = ref<NotificationPreferences>(mockNotifications())

  function updateNotification(key: keyof NotificationPreferences, value: boolean) {
    notifications.value[key] = value
  }

  return {
    activeRole,
    roleCapabilities,
    notifications,
    updateNotification,
  }
}
