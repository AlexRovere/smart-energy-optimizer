// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvPredictionTrigger from '../../app/components/EvPredictionTrigger.vue'

const successfulReturn = {
  siteId: 'SITE001',
  launched: true,
  available: true,
  predictedAt: '2026-09-23T10:32:05Z',
  nbPoints: 24,
  modelVersion: '3',
  durationMs: 412,
}

describe('EvPredictionTrigger', () => {
  it('propose « Lancer la prédiction » avant le premier appel', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: { siteId: 'SITE001' } })
    expect(wrapper.find('[data-testid="prediction-trigger"]').text()).toContain('Lancer la prédiction')
  })

  it('affiche la route appelée pour le site', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: { siteId: 'SITE004' } })
    expect(wrapper.text()).toContain('POST /api/sites/SITE004/prediction')
  })

  it('émet « launch » au clic', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: { siteId: 'SITE001' } })
    await wrapper.find('[data-testid="prediction-trigger"]').trigger('click')
    expect(wrapper.emitted('launch')).toHaveLength(1)
  })

  it("n'affiche aucun retour avant le premier appel", async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: { siteId: 'SITE001' } })
    expect(wrapper.find('[data-testid="prediction-result"]').exists()).toBe(false)
  })

  it('affiche « Calcul en cours » pendant l\'appel', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, {
      props: { siteId: 'SITE001', launched: true, pending: true }
    })
    expect(wrapper.find('[data-testid="prediction-result"]').text()).toContain('Calcul en cours')
  })

  it('résume le retour : points, version, durée', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: successfulReturn })
    const returned = wrapper.find('[data-testid="prediction-result"]').text()
    expect(returned).toContain('24 points')
    expect(returned).toContain('v3')
    expect(returned).toContain('412 ms')
    expect(returned).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('propose « Relancer » après un premier appel', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: successfulReturn })
    expect(wrapper.find('[data-testid="prediction-trigger"]').text()).toContain('Relancer')
  })

  it('signale un service indisponible', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, {
      props: { siteId: 'SITE001', launched: true, available: false, durationMs: 30 }
    })
    expect(wrapper.find('[data-testid="prediction-result"]').text()).toContain('Service de prédiction indisponible')
  })
})
