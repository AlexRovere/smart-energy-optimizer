import { ref } from 'vue'
import type { NotificationPreferences } from '~/types/api'

function mockNotifications(): NotificationPreferences {
  return { critical_alerts: true, daily_summary: true, sensor_fault: false }
}

export function useSettings() {
  const notifications = ref<NotificationPreferences>(mockNotifications())

  function updateNotification(key: keyof NotificationPreferences, value: boolean) {
    notifications.value[key] = value
  }

  return {
    notifications,
    updateNotification,
  }
}
