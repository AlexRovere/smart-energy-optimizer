// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import PredictionsPage from '../../app/pages/predictions.vue'

const useToastMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useToast', () => useToastMock)

const usePredictionsMock = vi.hoisted(() => vi.fn())
vi.mock('../../app/composables/usePredictions', () => ({ usePredictions: usePredictionsMock }))

// Forme de retour de usePredictions depuis #257 : la prévision n'est lancée qu'au clic.
const predictionDefaut = {
  selectedSiteId: ref('SITE001'),
  horizonHeures: ref(24),
  siteInfo: ref({ site_name: 'Bureau Paris' }),
  historicalPoints: ref([]),
  recommendations: ref([]),
  thresholdKw: ref(300),
  peakKw: ref(null),
  peakTime: ref(null),
  marginKw: ref(null),
  exceedanceExpected: ref(false),
  forecastPoints: ref([]),
  confidenceLevel: ref(0),
  modelVersion: ref(null),
  predictedAt: ref(null),
  nbPoints: ref(0),
  available: ref(true),
  lancer: vi.fn(),
  lancee: ref(false),
  dureeMs: ref(null),
  pending: ref(false),
  error: ref(null),
}

describe('page Prédictions', () => {
  it('affiche le bouton Injecter un pic', async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    usePredictionsMock.mockReturnValue(predictionDefaut)
    const wrapper = await mountSuspended(PredictionsPage)
    expect(wrapper.text()).toContain('Injecter un pic')
  })

  it('n\'affiche pas le gain cumulé appliqué', async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    usePredictionsMock.mockReturnValue(predictionDefaut)
    const wrapper = await mountSuspended(PredictionsPage)
    expect(wrapper.text()).not.toContain('gain cumulé appliqué')
  })

  it('affiche un toast au clic sur Injecter un pic', async () => {
    const toastAdd = vi.fn()
    useToastMock.mockReturnValue({ add: toastAdd })
    usePredictionsMock.mockReturnValue(predictionDefaut)
    const wrapper = await mountSuspended(PredictionsPage)
    await wrapper.find('[data-testid="injecter-pic-btn"]').trigger('click')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Fonctionnalité non disponible dans cette version',
      color: 'warning',
    }))
  })

  it('lance la prédiction au clic sur « Lancer la prédiction »', async () => {
    useToastMock.mockReturnValue({ add: vi.fn() })
    const lancer = vi.fn()
    usePredictionsMock.mockReturnValue({ ...predictionDefaut, lancer })
    const wrapper = await mountSuspended(PredictionsPage)
    await wrapper.find('[data-testid="prediction-trigger"]').trigger('click')
    expect(lancer).toHaveBeenCalledOnce()
  })
})
