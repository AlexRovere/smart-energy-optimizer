// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HelpPage from '../../app/pages/help.vue'
import { qualityHint, qualityLabel } from '../../app/utils/labels'

describe('page Aide', () => {
  it.each([
    'Charge et capacité',
    'Qualité des données',
    'kW et kWh',
    'Alertes, seuils et recommandations',
    'Prévisions',
  ])('couvre la section « %s »', async (section) => {
    const wrapper = await mountSuspended(HelpPage)
    expect(wrapper.findAll('h3').map(h => h.text())).toContain(section)
  })

  it("explique chaque niveau de qualité avec le libellé affiché à l'écran", async () => {
    const wrapper = await mountSuspended(HelpPage)
    for (const quality of ['good', 'partial', 'degraded', 'critical'] as const) {
      expect(wrapper.text()).toContain(qualityLabel(quality))
      expect(wrapper.text()).toContain(qualityHint(quality))
    }
  })

  it("illustre l'égalité kW et kWh au pas horaire", async () => {
    const wrapper = await mountSuspended(HelpPage)
    expect(wrapper.text()).toContain('120 kWh en une heure, c’est 120 kW en moyenne')
  })
})
