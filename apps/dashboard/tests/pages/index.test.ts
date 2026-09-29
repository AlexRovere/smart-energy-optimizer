// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import IndexPage from '../../app/pages/index.vue'

const useToastMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useToast', () => useToastMock)

const useFleetOverviewMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useFleetOverview', () => useFleetOverviewMock)

const navigateToMock = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateToMock)

const fleetDefaut = {
  stats: ref(null),
  totalConsumptionDisplay: ref('—'),
  totalCapacityDisplay: ref('—'),
  avgLoadDisplay: ref('—'),
  loadPercent: ref(null),
  hasIncompleteData: ref(false),
  excludedSites: ref([]),
  siteSummary: ref([]),
  sitesOkCount: ref(0),
  sitesDegradedCount: ref(0),
  sitesCriticalCount: ref(0),
  alerts: ref([]),
  alertsByLevel: ref({}),
  refreshedAt: ref(null),
  refreshFailed: ref(false),
  refresh: vi.fn(),
}

const SITE = {
  site_id: 'SITE003', site_name: 'Data Center Marseille', site_type: 'datacenter',
  current_consumption_kw: 400, capacity_kw: 800, load_percent: 50, data_quality: 'good', health: 'ok',
}

describe('page Vue d\'ensemble', () => {
  it('affiche le bouton Exporter le relevé', async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    useFleetOverviewMock.mockReturnValue(fleetDefaut)
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.text()).toContain('Exporter le relevé')
  })

  it('affiche un toast au clic sur Exporter le relevé', async () => {
    const toastAdd = vi.fn()
    useToastMock.mockReturnValue({ add: toastAdd })
    useFleetOverviewMock.mockReturnValue(fleetDefaut)
    const wrapper = await mountSuspended(IndexPage)
    await wrapper.find('[data-testid="exporter-btn"]').trigger('click')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fonctionnalité non disponible dans cette version',
      color: 'warning',
    }))
  })

  it("affiche l'heure du dernier rafraîchissement réussi", async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    useFleetOverviewMock.mockReturnValue({ ...fleetDefaut, refreshedAt: ref(new Date(2026, 8, 29, 14, 32).getTime()) })
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('Actualisé à 14:32')
    expect(wrapper.text()).not.toContain('stats/summary')
  })

  it('rafraîchit les données au clic sur Rafraîchir', async () => {
    const refresh = vi.fn()
    useToastMock.mockReturnValue({ add: vi.fn() })
    useFleetOverviewMock.mockReturnValue({ ...fleetDefaut, refresh })
    const wrapper = await mountSuspended(IndexPage)

    await wrapper.findAll('button').find(b => b.text() === 'Rafraîchir')!.trigger('click')

    expect(refresh).toHaveBeenCalledOnce()
  })

  it("ouvre le détail d'un site au clic sur sa ligne", async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    useFleetOverviewMock.mockReturnValue({ ...fleetDefaut, siteSummary: ref([SITE]) })
    const wrapper = await mountSuspended(IndexPage)

    await wrapper.find('tbody tr').trigger('click')

    expect(navigateToMock).toHaveBeenCalledWith('/sites/SITE003')
  })

  it("n'affiche plus de nom de champ technique", async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    useFleetOverviewMock.mockReturnValue({
      ...fleetDefaut,
      stats: ref({ sites_total: 7, sites_counted: 7, excluded_sites: [], timestamp: '2026-09-29T12:00:00Z' }),
    })
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).not.toContain('capacity_kw')
  })
})
