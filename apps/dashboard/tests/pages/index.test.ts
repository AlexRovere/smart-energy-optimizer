// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import IndexPage from '../../app/pages/index.vue'

const useToastMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useToast', () => useToastMock)

const useFleetOverviewMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useFleetOverview', () => useFleetOverviewMock)

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
})
