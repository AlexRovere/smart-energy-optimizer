// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EvPredictionChart from '../../app/components/EvPredictionChart.vue'
import type { PredictionPoint, Reading } from '../../app/types/api'

function makeHistorical(): Reading[] {
  return Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 3_600_000).toISOString(),
    site_id: 'SITE001',
    site_type: 'office',
    consumption_kw: 80 + i * 0.5,
    consumption_kwh: null,
    voltage_v: null,
    current_a: null,
    power_factor: null,
    temperature_celsius: null,
    humidity_percent: null,
    null_reasons: [],
    data_quality: 'good',
  }))
}

function makeForecast(length = 6): PredictionPoint[] {
  return Array.from({ length }, (_, i) => ({
    timestamp: new Date(Date.now() + (i + 1) * 3_600_000).toISOString(),
    predicted_consumption_kw: 95 + i,
    confidence_lower: 87 + i,
    confidence_upper: 103 + i,
  }))
}

const props = { historicalPoints: makeHistorical(), forecastPoints: makeForecast(), threshold: 240, confidenceLevel: 0.9 }

describe('EvPredictionChart', () => {
  it("annonce la durée mesurée et l'horizon prévu", async () => {
    const wrapper = await mountSuspended(EvPredictionChart, { props: { ...props, forecastPoints: makeForecast(48) } })
    expect(wrapper.text()).toContain('Mesuré (24 h) puis prévu (48 h)')
  })

  it('affiche la légende bande de confiance', async () => {
    const wrapper = await mountSuspended(EvPredictionChart, { props })
    expect(wrapper.text()).toContain('intervalle de confiance 90')
  })

  it('rend le graphique quand mesures et prévisions sont là', async () => {
    const wrapper = await mountSuspended(EvPredictionChart, { props })
    expect(wrapper.find('[data-testid="prediction-chart"]').exists()).toBe(true)
  })

  it('signale des données insuffisantes sans prévision', async () => {
    const wrapper = await mountSuspended(EvPredictionChart, { props: { ...props, forecastPoints: [] } })
    expect(wrapper.text()).toContain('Données insuffisantes')
    expect(wrapper.find('[data-testid="prediction-chart"]').exists()).toBe(false)
  })

  it("tait l'intervalle de confiance quand le modèle ne fournit pas de bornes", async () => {
    const withoutBounds = makeForecast().map(p => ({ ...p, confidence_lower: undefined, confidence_upper: undefined }))
    const wrapper = await mountSuspended(EvPredictionChart, { props: { ...props, forecastPoints: withoutBounds, confidenceLevel: 0 } })
    expect(wrapper.text()).not.toContain('intervalle de confiance')
  })
})
