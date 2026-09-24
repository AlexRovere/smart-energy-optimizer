// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SiteDetailPage from '../../app/pages/sites/[id].vue'

const useToastMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useToast', () => useToastMock)

const useSitesMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useSites', () => useSitesMock)

const useSiteCurrentReadingMock = vi.hoisted(() => vi.fn())
vi.mock('../../app/composables/useSiteCurrentReading', () => ({
  useSiteCurrentReading: useSiteCurrentReadingMock,
}))

const useSiteRecommendationsMock = vi.hoisted(() => vi.fn())
vi.mock('../../app/composables/useSiteRecommendations', () => ({
  useSiteRecommendations: useSiteRecommendationsMock,
}))

const useSiteHistoryMock = vi.hoisted(() => vi.fn())
vi.mock('../../app/composables/useSiteHistory', () => ({
  useSiteHistory: useSiteHistoryMock,
}))

const useSitePredictionMock = vi.hoisted(() => vi.fn())
vi.mock('../../app/composables/useSitePrediction', () => ({
  useSitePrediction: useSitePredictionMock,
}))

function setupMocks() {
  useSitesMock.mockReturnValue({
    getSite: () => ({ site_id: 'SITE001', site_name: 'Bureau Paris', capacity_kw: 300, status: 'active', data_quality: 'good' }),
    getSiteSensors: () => [],
    getSiteAlerts: () => [],
    getSiteHealth: () => 'ok',
    getSiteInfo: () => null,
  })
  useSiteCurrentReadingMock.mockReturnValue({ data: ref(null), pending: ref(false), error: ref(null) })
  useSiteRecommendationsMock.mockReturnValue({ recommendations: ref([]), pending: ref(false) })
  useSiteHistoryMock.mockReturnValue({ readings: ref([]) })
  useSitePredictionMock.mockReturnValue({
    forecastPoints: ref([]),
    modelVersion: ref(null),
    confidenceLevel: ref(0),
    predictedAt: ref(null),
    nbPoints: ref(0),
    available: ref(true),
    lancer: vi.fn(),
    lancee: ref(false),
    dureeMs: ref(null),
    pending: ref(false),
  })
}

describe('page Site détail', () => {
  it('affiche le bouton Configurer les seuils', async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    setupMocks()
    const wrapper = await mountSuspended(SiteDetailPage)
    expect(wrapper.text()).toContain('Configurer les seuils')
  })

  it('affiche un toast au clic sur Configurer les seuils', async () => {
    const toastAdd = vi.fn()
    useToastMock.mockReturnValue({ add: toastAdd })
    setupMocks()
    const wrapper = await mountSuspended(SiteDetailPage)
    await wrapper.find('[data-testid="configurer-seuils-btn"]').trigger('click')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fonctionnalité non disponible dans cette version',
      color: 'warning',
    }))
  })
})
