import { ref } from 'vue'
import type { NotificationPreferences } from '~/types/api'

// Le rôle ne vit plus ici : il est lu du compte connecté (useAccountSession).
export function useSettings() {
  const notifications = ref<NotificationPreferences>({ critical_alerts: true, daily_summary: true, sensor_fault: false })

  function updateNotification(key: keyof NotificationPreferences, value: boolean) {
    notifications.value[key] = value
  }

  return {
    notifications,
    updateNotification,
  }
}
