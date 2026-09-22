import { ref, computed } from 'vue'
import type { UserRole, NotificationPreferences, SessionInfo } from '~/types/api'

const ROLE_CAPABILITIES: Record<UserRole, string[]> = {
  admin: [
    'Lecture du parc et des alertes',
    'Écriture des seuils + simulation',
    'Export du relevé réglementaire',
  ],
  operator: [
    'Lecture du parc et des alertes',
    'Écriture des seuils + simulation',
  ],
  viewer: [
    'Lecture du parc et des alertes',
  ],
}

function mockNotifications(): NotificationPreferences {
  return { critical_alerts: true, daily_summary: true, sensor_fault: false }
}

function mockSession(): SessionInfo {
  return {
    user_name: 'M. Deschamps',
    role: 'Administrateur',
    polling_interval_s: 10,
    health_label: 'API healthy · /health 200',
  }
}

export function useSettings() {
  const activeRole = ref<UserRole>('admin')
  const roleCapabilities = computed(() => ROLE_CAPABILITIES[activeRole.value])

  const notifications = ref<NotificationPreferences>(mockNotifications())

  function updateNotification(key: keyof NotificationPreferences, value: boolean) {
    notifications.value[key] = value
  }

  const session = ref<SessionInfo>(mockSession())

  return {
    activeRole,
    roleCapabilities,
    notifications,
    updateNotification,
    session
  }
}