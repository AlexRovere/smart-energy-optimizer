// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SitesPage from '../../app/pages/sites/index.vue'

const useSitesMock = vi.hoisted(() => vi.fn())
const useFleetOverviewMock = vi.hoisted(() => vi.fn())
const useAlertsMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useSites', () => useSitesMock)
mockNuxtImport('useFleetOverview', () => useFleetOverviewMock)
mockNuxtImport('useAlerts', () => useAlertsMock)

function site(site_id: string, health: string) {
  return { site_id, site_name: site_id, site_type: 'office', current_consumption_kw: 10, capacity_kw: 100, load_percent: 10, data_quality: 'good', health, last_data_at: null }
}

function mountPage(refresh = vi.fn()) {
  useSitesMock.mockReturnValue({
    sites: ref([site('SITE001', 'ok'), site('SITE002', 'degraded'), site('SITE003', 'critical')]),
    getSiteAlerts: () => [],
  })
  useFleetOverviewMock.mockReturnValue({ refreshedAt: ref(null), refreshFailed: ref(false), refresh })
  useAlertsMock.mockReturnValue({ alerts: ref([]), pending: ref(false), error: ref(null) })
  return mountSuspended(SitesPage)
}

describe('page Sites et capteurs', () => {
  it('résume la santé du parc en français', async () => {
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('1 sain')
    expect(wrapper.text()).toContain('1 dégradé')
    expect(wrapper.text()).toContain('1 critique')
    expect(wrapper.text()).not.toContain('degraded')
  })

  it('rafraîchit les données au clic sur Rafraîchir', async () => {
    const refresh = vi.fn()
    const wrapper = await mountPage(refresh)

    await wrapper.findAll('button').find(b => b.text() === 'Rafraîchir')!.trigger('click')

    expect(refresh).toHaveBeenCalledOnce()
  })
})
