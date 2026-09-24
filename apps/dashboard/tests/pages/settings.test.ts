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
const useAccountSessionMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useAlertThresholds', () => useAlertThresholdsMock)
mockNuxtImport('useSitesList', () => useSitesListMock)
mockNuxtImport('useAccountSession', () => useAccountSessionMock)

const THRESHOLDS: AlertThresholdEntry[] = [
  { site_id: 'SITE001', type: 'conso', duration: 12, threshold: 350 }
]
const SITES: SiteApiItem[] = [
  { site_id: 'SITE001', site_name: 'Bureau Paris', site_type: 'office', location: null, capacity_kw: 300, status: 'active', warning_threshold_kw: null, present_in_source: true }
]

function setupSettingsMocks(updateNotificationSpy = vi.fn()) {
  useToastMock.mockReturnValue({ add: vi.fn() })
  useSettingsMock.mockReturnValue({
    notifications: ref({ critical_alerts: true, daily_summary: true, sensor_fault: false }),
    updateNotification: updateNotificationSpy,
  })
  useAlertThresholdsMock.mockReturnValue({ thresholds: ref(THRESHOLDS), pending: ref(false), error: ref(null), save: vi.fn() })
  useSitesListMock.mockReturnValue({ sites: ref(SITES), pending: ref(false), error: ref(null) })
  useAccountSessionMock.mockReturnValue({
    account: ref({ id: '1', email: 'admin@test.fr', role: 'ADMIN', sites: [] }),
    logout: vi.fn(),
  })
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
    setupSettingsMocks()
    useToastMock.mockReturnValue({ add: toastAdd })
    const wrapper = await mountSuspended(SettingsPage)
    await wrapper.find('[role="switch"]').trigger('click')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fonctionnalité non disponible dans cette version',
      color: 'warning',
    }))
  })

  it('affiche l\'email du compte dans la carte session', async () => {
    setupSettingsMocks()
    const wrapper = await mountSuspended(SettingsPage)

    expect(wrapper.text()).toContain('admin@test.fr')
  })

  it('le sélecteur de rôle est absent', async () => {
    setupSettingsMocks()
    const wrapper = await mountSuspended(SettingsPage)

    expect(wrapper.text()).not.toContain('Opérateur')
    expect(wrapper.text()).not.toContain('Lecteur')
  })
})
