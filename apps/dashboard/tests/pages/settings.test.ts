// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SettingsPage from '../../app/pages/settings.vue'
import type { AlertThresholdEntry } from '../../shared/alertThresholdSchema'
import type { SiteApiItem } from '../../shared/siteSchema'

const useToastMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useToast', () => useToastMock)

const useSettingsMock = vi.hoisted(() => vi.fn())
vi.mock('../../app/composables/useSettings', () => ({
  useSettings: useSettingsMock
}))

const useAlertThresholdsMock = vi.hoisted(() => vi.fn())
const useSitesListMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useAlertThresholds', () => useAlertThresholdsMock)
mockNuxtImport('useSitesList', () => useSitesListMock)

const THRESHOLDS: AlertThresholdEntry[] = [
  { site_id: 'SITE001', type: 'conso', duration: 12, threshold: 350 }
]
const SITES: SiteApiItem[] = [
  { site_id: 'SITE001', site_name: 'Bureau Paris', site_type: 'office', location: null, capacity_kw: 300, status: 'active', warning_threshold_kw: null, present_in_source: true }
]

function setupSettingsMocks(updateNotificationSpy = vi.fn()) {
  useToastMock.mockReturnValue({ add: vi.fn() })
  useSettingsMock.mockReturnValue({
    activeRole: ref('admin'),
    roleCapabilities: ref(['Lecture du parc et des alertes']),
    notifications: ref({ critical_alerts: true, daily_summary: true, sensor_fault: false }),
    updateNotification: updateNotificationSpy,
    session: ref({ user_name: 'M. Deschamps', role: 'Administrateur', polling_interval_s: 10, health_label: 'ok' })
  })
  useAlertThresholdsMock.mockReturnValue({ thresholds: ref(THRESHOLDS), pending: ref(false), error: ref(null), save: vi.fn() })
  useSitesListMock.mockReturnValue({ sites: ref(SITES), pending: ref(false), error: ref(null) })
}

describe('page Paramétrages', () => {
  it('affiche les règles d\'alerte par site à la place de l\'ancien mock de seuils', async () => {
    setupSettingsMocks()
    const wrapper = await mountSuspended(SettingsPage)

    expect(wrapper.text()).toContain("Règles d'alerte par site")
    expect(wrapper.text()).toContain('Bureau Paris')
    expect(wrapper.text()).toContain('350 kWh')
    expect(wrapper.text()).not.toContain("en attendant le contrat API")
  })

  it('affiche un toast au clic sur un toggle de notification', async () => {
    const toastAdd = vi.fn()
    useToastMock.mockReturnValue({ add: toastAdd })
    setupSettingsMocks()
    useToastMock.mockReturnValue({ add: toastAdd })
    const wrapper = await mountSuspended(SettingsPage)
    await wrapper.find('[role="switch"]').trigger('click')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fonctionnalité non disponible dans cette version',
      color: 'warning',
    }))
  })
})
