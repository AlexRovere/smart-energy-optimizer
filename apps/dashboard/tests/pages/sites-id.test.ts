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

const READING = {
  site_id: 'SITE001', site_type: 'office', timestamp: '2026-09-29T12:00:00Z',
  consumption_kw: 120, consumption_kwh: 120, voltage_v: 400, current_a: 180, power_factor: 0.93,
  temperature_celsius: 21, humidity_percent: 45, data_quality: 'good', null_reasons: [],
}

function setupMocks() {
  useSitesMock.mockReturnValue({
    getSite: () => ({ site_id: 'SITE001', site_name: 'Bureau Paris', site_type: 'office', capacity_kw: 300, status: 'active', data_quality: 'good' }),
    getSiteSensors: () => [],
    getSiteAlerts: () => [],
    getSiteHealth: () => 'ok',
    getSiteInfo: () => ({ location: 'Paris', threshold_kw: 250, status: 'active' }),
  })
  useSiteCurrentReadingMock.mockReturnValue({ data: ref(READING), pending: ref(false), error: ref(null) })
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

  it.each(['capacity_kw', 'site_type', 'current_a', 'humidity_pct', 'alerts_active', 'model_version', 'GET /api'])(
    "n'affiche plus le nom technique %s",
    async (technicalName) => {
      useToastMock.mockReturnValue({ add: vi.fn() })
      setupMocks()
      const wrapper = await mountSuspended(SiteDetailPage)
      expect(wrapper.text()).not.toContain(technicalName)
    },
  )

  it('affiche capacité et seuil avec leur unité, le type et le statut en français', async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    setupMocks()
    const wrapper = await mountSuspended(SiteDetailPage)
    const text = wrapper.text()

    expect(text).toContain('300 kW')
    expect(text).toContain('250 kW')
    expect(text).toContain('Bureaux')
    expect(text).toContain('En service')
  })
})
