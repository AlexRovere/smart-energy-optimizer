// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvAlertPopup from '../../app/components/EvAlertPopup.vue'
import type { Recommendation } from '../../app/types/api'

const RECOMMENDATION: Recommendation = {
  recommendation_id: 'REC-SITE001-pic-2026-09-18T10:00:00.000Z',
  site_id: 'SITE001',
  source: 'threshold',
  type: 'load_balancing',
  priority: 'high',
  title: 'Lisser le pic de consommation',
  description: 'Décaler les charges non prioritaires',
  trigger: { timestamp: '2026-09-18T10:00:00.000Z', value_kw: 310, threshold_kw: 300 },
  estimated_saving_kwh: 0,
  gain_kw: 0,
  confidence: 0,
  window: 'N/A'
}

describe('EvAlertPopup', () => {
  it('ne rend rien quand open est faux', async () => {
    const wrapper = await mountSuspended(EvAlertPopup, {
      props: { open: false, siteName: 'Bureau Paris', recommendations: [RECOMMENDATION] }
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it.each([
    ['le site impacté', 'Bureau Paris'],
    ['la sévérité de la règle déclenchée', 'HIGH'],
    ['la recommandation associée', 'Lisser le pic de consommation'],
  ])('affiche %s', async (_description, expectedText) => {
    const wrapper = await mountSuspended(EvAlertPopup, {
      props: { open: true, siteName: 'Bureau Paris', recommendations: [RECOMMENDATION] }
    })
    expect(wrapper.text()).toContain(expectedText)
  })

  it('émet close au clic sur le bouton fermer', async () => {
    const wrapper = await mountSuspended(EvAlertPopup, {
      props: { open: true, siteName: 'Bureau Paris', recommendations: [RECOMMENDATION] }
    })
    await wrapper.find('[data-testid="close-btn"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
