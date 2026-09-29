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
    getSiteSensors: () => [
      { family: 'consumption', status: 'ok', failing_until: null },
      { family: 'humidity', status: 'failing', failing_until: new Date(2026, 8, 29, 8, 15).toISOString() },
    ],
    getSiteAlerts: () => [],
    getSiteHealth: () => 'ok',
    getSiteInfo: () => ({ location: 'Paris', threshold_kw: 250, status: 'active', last_data_at: new Date(2026, 8, 29, 13, 0).toISOString() }),
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

  // Monte la page avec les mocks par défaut et rend son texte.
  async function pageText(): Promise<string> {
    useToastMock.mockReturnValue({ add: vi.fn() })
    return (await mountSuspended(SiteDetailPage)).text()
  }

  it.each([
    'capacity_kw', 'site_type', 'current_a', 'humidity_pct', 'alerts_active', 'model_version', 'GET /api',
    'sensors/status', 'last_seen', 'failing', 'humidity',
  ])("n'affiche plus le nom technique %s", async (technicalName) => {
    setupMocks()
    expect(await pageText()).not.toContain(technicalName)
  })

  it('affiche capacité et seuil avec leur unité, le type et le statut en français', async () => {
    setupMocks()
    const text = await pageText()

    for (const attendu of ['300 kW', '250 kW', 'Bureaux', 'En service']) expect(text).toContain(attendu)
  })

  it("affiche l'état de chaque capteur en français, avec la fin prévue d'une panne", async () => {
    setupMocks()
    const text = await pageText()

    for (const attendu of ['Consommation', 'Humidité', 'En panne', "jusqu'à 08:15"]) expect(text).toContain(attendu)
  })

  it('donne la date de la dernière donnée du site', async () => {
    setupMocks()
    expect(await pageText()).toMatch(/Dernière donnée.*29\/09 13:00/)
  })

  it('reporte la dernière valeur connue quand la consommation courante manque', async () => {
    setupMocks()
    useSiteCurrentReadingMock.mockReturnValue({ data: ref({ ...READING, consumption_kw: null }), pending: ref(false), error: ref(null) })
    useSiteHistoryMock.mockReturnValue({
      readings: ref([{ ...READING, timestamp: new Date(2026, 8, 29, 12, 0).toISOString(), consumption_kw: null, consumption_kw_corrected: 104 }]),
    })
    const text = await pageText()

    expect(text).toContain('104')
    expect(text).toContain('valeur reportée de 12:00')
  })
})
