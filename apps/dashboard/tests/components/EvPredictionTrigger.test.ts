// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvPredictionTrigger from '../../app/components/EvPredictionTrigger.vue'

const retourRéussi = {
  siteId: 'SITE001',
  lancee: true,
  available: true,
  predictedAt: '2026-09-23T10:32:05Z',
  nbPoints: 24,
  modelVersion: '3',
  dureeMs: 412,
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

  it('émet « lancer » au clic', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: { siteId: 'SITE001' } })
    await wrapper.find('[data-testid="prediction-trigger"]').trigger('click')
    expect(wrapper.emitted('lancer')).toHaveLength(1)
  })

  it("n'affiche aucun retour avant le premier appel", async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: { siteId: 'SITE001' } })
    expect(wrapper.find('[data-testid="prediction-retour"]').exists()).toBe(false)
  })

  it('affiche « Calcul en cours » pendant l\'appel', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, {
      props: { siteId: 'SITE001', lancee: true, pending: true }
    })
    expect(wrapper.find('[data-testid="prediction-retour"]').text()).toContain('Calcul en cours')
  })

  it('résume le retour : points, version, durée', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: retourRéussi })
    const retour = wrapper.find('[data-testid="prediction-retour"]').text()
    expect(retour).toContain('24 points')
    expect(retour).toContain('v3')
    expect(retour).toContain('412 ms')
    expect(retour).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('propose « Relancer » après un premier appel', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, { props: retourRéussi })
    expect(wrapper.find('[data-testid="prediction-trigger"]').text()).toContain('Relancer')
  })

  it('signale un service indisponible', async () => {
    const wrapper = await mountSuspended(EvPredictionTrigger, {
      props: { siteId: 'SITE001', lancee: true, available: false, dureeMs: 30 }
    })
    expect(wrapper.find('[data-testid="prediction-retour"]').text()).toContain('Service de prédiction indisponible')
  })
})
