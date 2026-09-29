import { describe, expect, it } from 'vitest'
import {
  consumptionChartOption,
  historyTitle,
  peakReading,
  predictionChartOption,
  predictionTitle,
} from '../../app/utils/charts'
import type { PredictionPoint, Reading } from '../../app/types/api'

const T0 = Date.parse('2026-09-28T00:00:00Z')
const HOUR = 3_600_000

function reading(i: number, kw: number | null): Reading {
  return {
    timestamp: new Date(T0 + i * HOUR).toISOString(),
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
  }
}

function forecast(i: number, kw: number, bounds = true): PredictionPoint {
  return {
    timestamp: new Date(T0 + (24 + i) * HOUR).toISOString(),
    predicted_consumption_kw: kw,
    confidence_lower: bounds ? kw - 10 : undefined,
    confidence_upper: bounds ? kw + 10 : undefined,
  }
}

const readings = [reading(0, 120), reading(1, null), reading(2, 610), reading(3, 140)]

// Les options ECharts sont des unions larges : on les relit comme des objets simples.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

function series(option: Loose, id: string): Loose {
  return option.series.find((s: Loose) => s.id === id)
}

describe('consumptionChartOption', () => {
  const base = { readings, capacityKw: 450, thresholdKw: 300, window: '24h' as const, tone: 'dark' as const }

  it('ne rend rien sans aucune consommation mesurée', () => {
    expect(consumptionChartOption({ ...base, readings: [reading(0, null)] })).toBeNull()
  })

  it('place les mesures sur un axe temporel', () => {
    const option: Loose = consumptionChartOption(base)

    expect(option.xAxis.type).toBe('time')
    expect(series(option, 'consumption').data[0]).toEqual([T0, 120])
  })

  it('laisse un trou pour une mesure manquante au lieu de relier les voisines', () => {
    const line = series(consumptionChartOption(base), 'consumption')

    expect(line.data[1]).toEqual([T0 + HOUR, null])
    expect(line.connectNulls).toBe(false)
  })

  it("adapte l'axe vertical aux données plutôt qu'à des graduations figées", () => {
    const option: Loose = consumptionChartOption(base)

    expect(option.yAxis.interval).toBeUndefined()
    expect(option.yAxis.max).toBeGreaterThanOrEqual(610)
  })

  it('garde la capacité et le seuil visibles même au-dessus des mesures', () => {
    const option: Loose = consumptionChartOption({ ...base, capacityKw: 900, thresholdKw: 950 })

    expect(option.yAxis.max).toBeGreaterThanOrEqual(950)
  })

  it('trace la capacité et le seuil avec leur valeur et leur unité', () => {
    const lines = series(consumptionChartOption(base), 'consumption').markLine.data

    expect(lines.map((l: Loose) => [l.yAxis, l.name])).toEqual([
      [450, 'capacité 450 kW'],
      [300, 'seuil 300 kW'],
    ])
  })

  it("n'affiche pas de seuil quand aucun n'est configuré", () => {
    const lines = series(consumptionChartOption({ ...base, thresholdKw: null }), 'consumption').markLine.data

    expect(lines.map((l: Loose) => l.name)).toEqual(['capacité 450 kW'])
  })

  it.each([
    ['24h', '{HH}:{mm}'],
    ['7j', '{dd}/{MM}'],
  ] as const)('étiquette l’axe du temps selon la fenêtre %s', (window, format) => {
    const option: Loose = consumptionChartOption({ ...base, window })

    expect(option.xAxis.axisLabel.formatter).toBe(format)
  })

  it('donne la valeur et son unité au survol', () => {
    const option: Loose = consumptionChartOption(base)

    expect(option.tooltip.trigger).toBe('axis')
    expect(option.tooltip.valueFormatter(123.456)).toBe('123,5 kW')
    expect(option.tooltip.valueFormatter(null)).toBe('donnée manquante')
  })
})

describe('historyTitle : plage choisie', () => {
  it('annonce les deux bornes', () => {
    const range = { from: new Date(2026, 8, 1).toISOString(), to: new Date(2026, 8, 16).toISOString() }
    expect(historyTitle('custom', range)).toBe('Historique de consommation, du 01/09 au 15/09')
  })
})

describe('historyTitle', () => {
  it.each([
    ['24h', 'Historique de consommation, 24 dernières heures'],
    ['7j', 'Historique de consommation, 7 derniers jours'],
  ] as const)('suit la fenêtre %s', (window, title) => {
    expect(historyTitle(window)).toBe(title)
  })
})

describe('peakReading', () => {
  it('retient la plus forte consommation mesurée', () => {
    expect(peakReading(readings)).toEqual({ kw: 610, timestamp: T0 + 2 * HOUR })
  })

  it('ne rend rien sans mesure', () => {
    expect(peakReading([reading(0, null)])).toBeNull()
  })
})

describe('predictionChartOption', () => {
  const history = Array.from({ length: 24 }, (_, i) => reading(i, 100 + i))
  const base = {
    historical: history,
    forecast: [forecast(0, 130), forecast(1, 140), forecast(2, 150)],
    thresholdKw: 240,
    tone: 'light' as const,
  }

  it('ne rend rien sans mesure ou sans prévision', () => {
    expect(predictionChartOption({ ...base, forecast: [] })).toBeNull()
    expect(predictionChartOption({ ...base, historical: [] })).toBeNull()
  })

  it('place mesures et prévisions sur le même axe temporel', () => {
    const option: Loose = predictionChartOption(base)

    expect(option.xAxis.type).toBe('time')
    expect(series(option, 'historical').data.at(-1)).toEqual([T0 + 23 * HOUR, 123])
    expect(series(option, 'forecast').data[1]).toEqual([T0 + 24 * HOUR, 130])
  })

  it('raccorde la prévision au dernier point mesuré', () => {
    const option: Loose = predictionChartOption(base)

    expect(series(option, 'forecast').data).toHaveLength(4)
    expect(series(option, 'forecast').data[0]).toEqual([T0 + 23 * HOUR, 123])
  })

  it("dessine la bande de confiance par empilement de l'écart", () => {
    const option: Loose = predictionChartOption(base)

    expect(series(option, 'band-lower').data[0]).toEqual([T0 + 24 * HOUR, 120])
    expect(series(option, 'band-width').data[0]).toEqual([T0 + 24 * HOUR, 20])
    expect(series(option, 'band-width').stack).toBe(series(option, 'band-lower').stack)
  })

  it("n'affiche pas de bande quand les bornes manquent", () => {
    const option: Loose = predictionChartOption({ ...base, forecast: [forecast(0, 130, false)] })

    expect(series(option, 'band-lower')).toBeUndefined()
    expect(series(option, 'band-width')).toBeUndefined()
  })

  it('trace le seuil avec sa valeur', () => {
    const lines = series(predictionChartOption(base), 'historical').markLine.data

    expect(lines.map((l: Loose) => l.name)).toContain('seuil 240 kW')
  })

  it('englobe la borne haute de la bande dans l’axe vertical', () => {
    const option: Loose = predictionChartOption({ ...base, forecast: [forecast(0, 400)] })

    expect(option.yAxis.max).toBeGreaterThanOrEqual(410)
  })
})

describe('predictionTitle', () => {
  it('annonce la durée mesurée et l’horizon prévu', () => {
    const history = Array.from({ length: 24 }, (_, i) => reading(i, 100))
    expect(predictionTitle(history, Array.from({ length: 48 }, (_, i) => forecast(i, 100)))).toBe(
      'Mesuré (24 h) puis prévu (48 h)',
    )
  })

  it('passe en jours au-delà de deux jours mesurés', () => {
    const history = Array.from({ length: 168 }, (_, i) => reading(i, 100))
    expect(predictionTitle(history, [forecast(0, 100)])).toBe('Mesuré (7 j) puis prévu (1 h)')
  })
})

describe('consumptionChartOption : plage choisie', () => {
  it("étiquette l'axe selon la durée de la plage", () => {
    const base = { readings, capacityKw: 450, thresholdKw: 300, tone: 'dark' as const }
    const oneDay = consumptionChartOption({ ...base, window: 'custom' })
    expect((oneDay as Loose).xAxis.axisLabel.formatter).toBe('{HH}:{mm}')

    const longer = [reading(0, 120), { ...reading(0, 130), timestamp: new Date(T0 + 72 * HOUR).toISOString() }]
    const several = consumptionChartOption({ ...base, readings: longer, window: 'custom' })
    expect((several as Loose).xAxis.axisLabel.formatter).toBe('{dd}/{MM}')
  })
})
