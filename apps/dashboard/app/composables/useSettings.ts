import { ref, computed } from 'vue'
import type { UserRole, SiteThresholdEntry, NotificationPreferences, SessionInfo } from '~/types/api'

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

function mockSiteThresholds(): SiteThresholdEntry[] {
  return [
    { site_id: 'SITE001', site_name: 'Bureau Paris La Défense', capacity_kw: 300,  threshold_kw: 240, state: 'enregistré' },
    { site_id: 'SITE002', site_name: 'Usine Lyon Vénissieux',   capacity_kw: 1000, threshold_kw: 720, state: 'enregistré' },
    { site_id: 'SITE003', site_name: 'Data Center Marseille',   capacity_kw: 800,  threshold_kw: 640, state: 'enregistré' },
  ]
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

  const _origin = mockSiteThresholds()
  const siteThresholds = ref<SiteThresholdEntry[]>(mockSiteThresholds())

  const hasUnsavedChanges = computed(() => 
    siteThresholds.value.some(e => e.state === 'modifié')
  )

  function updateThreshold(siteId: string, value: number) {
    const entry = siteThresholds.value.find(e => e.site_id === siteId)
    if (entry) {
      entry.threshold_kw = value
      entry.state = 'modifié'
    }
  }

  function resetThresholds() {
    siteThresholds.value = _origin.map(e => ({ ...e }))
  }

  function saveThresholds() {
    for (const entry of siteThresholds.value) {
      entry.state = 'enregistré'
    }
  }

  function capacityPercent(entry: SiteThresholdEntry): number {
    return Math.round(entry.threshold_kw / entry.capacity_kw * 100)
  }

  const notifications = ref<NotificationPreferences>(mockNotifications())

  function updateNotification(key: keyof NotificationPreferences, value: boolean) {
    notifications.value[key] = value
  }

  const session = ref<SessionInfo>(mockSession())

  return {
    activeRole,
    roleCapabilities,
    siteThresholds,
    hasUnsavedChanges,
    updateThreshold,
    resetThresholds,
    saveThresholds,
    capacityPercent,
    notifications,
    updateNotification,
    session
  }
}