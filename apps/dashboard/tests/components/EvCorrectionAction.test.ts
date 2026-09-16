// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvCorrectionAction from '../../app/components/EvCorrectionAction.vue'
import type { Recommendation } from '../../app/types/api'

const mockRec: Recommendation = {
  recommendation_id: 'REC-SITE001-1',
  site_id: 'SITE001',
  source: 'forecast',
  type: 'scheduling',
  priority: 'high',
  title: 'Décaler la relance CVC de 45 min',
  description: 'fenêtre 14:30 → 15:15 · confiance haute',
  trigger: { timestamp: '2026-09-16T14:00:00Z', value_kw: 98, threshold_kw: 240 },
  estimated_saving_kwh: 12,
  gain_kw: -17,
  confidence: 0.88,
  window: '14:30 → 15:15',
}

describe('EvCorrectionAction', () => {
  it('affiche le titre de la recommandation', async () => {
    const wrapper = await mountSuspended(EvCorrectionAction, { props: { recommendation: mockRec } })
    expect(wrapper.text()).toContain('Décaler la relance CVC de 45 min')
  })

  it('affiche la description (fenêtre + confiance)', async () => {
    const wrapper = await mountSuspended(EvCorrectionAction, { props: { recommendation: mockRec } })
    expect(wrapper.text()).toContain('fenêtre 14:30 → 15:15 · confiance haute')
  })

  it('affiche le gain en kW', async () => {
    const wrapper = await mountSuspended(EvCorrectionAction, { props: { recommendation: mockRec } })
    expect(wrapper.text()).toContain('-17')
    expect(wrapper.text()).toContain('kW')
  })

  it('affiche le score de confiance', async () => {
    const wrapper = await mountSuspended(EvCorrectionAction, { props: { recommendation: mockRec } })
    expect(wrapper.text()).toContain('0,88')
  })

  it('affiche le bouton Appliquer', async () => {
    const wrapper = await mountSuspended(EvCorrectionAction, { props: { recommendation: mockRec } })
    expect(wrapper.text()).toContain('Appliquer')
  })

  it("émet l'événement apply au clic sur Appliquer", async () => {
    const wrapper = await mountSuspended(EvCorrectionAction, { props: { recommendation: mockRec } })
    const btn = wrapper.find('[data-testid="apply-btn"]')
    await btn.trigger('click')
    expect(wrapper.emitted('apply')).toHaveLength(1)
    expect(wrapper.emitted('apply')![0]).toEqual([mockRec.recommendation_id])
  })
})
