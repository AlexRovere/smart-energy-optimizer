// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import PredictionsPage from '../../app/pages/predictions.vue'

const useToastMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useToast', () => useToastMock)

const usePredictionsMock = vi.hoisted(() => vi.fn())
vi.mock('../../app/composables/usePredictions', () => ({ usePredictions: usePredictionsMock }))

const predictionDefaut = {
  selectedSiteId: ref('SITE001'),
  siteInfo: ref({ site_name: 'Bureau Paris' }),
  prediction: ref({ horizon_hours: 24, predictions: [], confidence_level: 0.9 }),
  historicalPoints: ref([]),
  recommendations: ref([]),
  thresholdKw: ref(300),
  peakKw: ref(250),
  peakTime: ref('14:00'),
  marginKw: ref(50),
  exceedanceExpected: ref(false),
  modelConfidence: ref(90),
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
})
