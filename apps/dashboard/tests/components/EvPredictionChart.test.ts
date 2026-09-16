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

function makeForecast(): PredictionPoint[] {
  return Array.from({ length: 6 }, (_, i) => ({
    timestamp: new Date(Date.now() + (i + 1) * 3_600_000).toISOString(),
    predicted_consumption_kw: 95 + i,
    confidence_lower: 87 + i,
    confidence_upper: 103 + i,
  }))
}

describe('EvPredictionChart', () => {
  it('affiche le titre du graphique', async () => {
    const wrapper = await mountSuspended(EvPredictionChart, {
      props: { historicalPoints: makeHistorical(), forecastPoints: makeForecast(), threshold: 240, confidenceLevel: 0.9 },
    })
    expect(wrapper.text()).toContain('Mesuré (24 h) puis prévu (6 h)')
  })

  it('affiche la légende bande de confiance', async () => {
    const wrapper = await mountSuspended(EvPredictionChart, {
      props: { historicalPoints: makeHistorical(), forecastPoints: makeForecast(), threshold: 240, confidenceLevel: 0.9 },
    })
    expect(wrapper.text()).toContain('intervalle de confiance 90')
  })

  it('rend la ligne historique', async () => {
    const wrapper = await mountSuspended(EvPredictionChart, {
      props: { historicalPoints: makeHistorical(), forecastPoints: makeForecast(), threshold: 240, confidenceLevel: 0.9 },
    })
    expect(wrapper.find('[data-testid="historical-line"]').exists()).toBe(true)
  })

  it('rend la ligne de prévision', async () => {
    const wrapper = await mountSuspended(EvPredictionChart, {
      props: { historicalPoints: makeHistorical(), forecastPoints: makeForecast(), threshold: 240, confidenceLevel: 0.9 },
    })
    expect(wrapper.find('[data-testid="forecast-line"]').exists()).toBe(true)
  })

  it('rend la bande de confiance', async () => {
    const wrapper = await mountSuspended(EvPredictionChart, {
      props: { historicalPoints: makeHistorical(), forecastPoints: makeForecast(), threshold: 240, confidenceLevel: 0.9 },
    })
    expect(wrapper.find('[data-testid="confidence-band"]').exists()).toBe(true)
  })

  it('rend la ligne de seuil', async () => {
    const wrapper = await mountSuspended(EvPredictionChart, {
      props: { historicalPoints: makeHistorical(), forecastPoints: makeForecast(), threshold: 240, confidenceLevel: 0.9 },
    })
    expect(wrapper.find('[data-testid="threshold-line"]').exists()).toBe(true)
  })
})
