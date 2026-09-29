// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvConsumptionChart from '../../app/components/EvConsumptionChart.vue'
import type { Reading } from '../../app/types/api'

function makeReadings(values: (number | null)[]): Reading[] {
  return values.map((kw, i) => ({
    timestamp: new Date(Date.UTC(2026, 8, 28, i)).toISOString(),
    site_id: 'SITE001',
    site_type: 'office',
    consumption_kw: kw,
    consumption_kwh: kw,
    voltage_v: null,
    current_a: null,
    power_factor: null,
    temperature_celsius: null,
    humidity_percent: null,
    null_reasons: [],
    data_quality: 'good',
  }))
}

const props = { readings: makeReadings([120, 310.5, 140]), capacityKw: 450, thresholdKw: 300, window: '24h' as const }

describe('EvConsumptionChart', () => {
  it.each([
    ['24h', 'Historique de consommation, 24 dernières heures'],
    ['7j', 'Historique de consommation, 7 derniers jours'],
  ] as const)('titre qui suit la fenêtre %s', async (window, title) => {
    const wrapper = await mountSuspended(EvConsumptionChart, { props: { ...props, window } })
    expect(wrapper.text()).toContain(title)
  })

  it('annonce le pic mesuré avec son unité', async () => {
    const wrapper = await mountSuspended(EvConsumptionChart, { props })
    expect(wrapper.text()).toContain('pic mesuré 310,5 kW')
  })

  it('émet le changement de fenêtre', async () => {
    const wrapper = await mountSuspended(EvConsumptionChart, { props })
    await wrapper.findAll('button').find(b => b.text() === '7j')!.trigger('click')
    expect(wrapper.emitted('update:window')).toEqual([['7j']])
  })

  it('rend le graphique quand une mesure existe', async () => {
    const wrapper = await mountSuspended(EvConsumptionChart, { props })
    expect(wrapper.find('[data-testid="consumption-chart"]').exists()).toBe(true)
  })

  it('signale une absence de données', async () => {
    const wrapper = await mountSuspended(EvConsumptionChart, { props: { ...props, readings: makeReadings([null]) } })
    expect(wrapper.text()).toContain('Aucune donnée historique disponible')
    expect(wrapper.find('[data-testid="consumption-chart"]').exists()).toBe(false)
  })
})
