// Configuration des graphiques ECharts, en fonctions pures : tout ce qui se
// décide (axes, seuils, bande de confiance, titres) se teste ici, sans rendu.
// Les composants EvConsumptionChart et EvPredictionChart ne font qu'afficher.
import type { EChartsOption, LineSeriesOption } from 'echarts'
import type { PredictionPoint, Reading } from '../types/api'

export type ChartWindow = '24h' | '7j' | 'custom'
export type ChartTone = 'dark' | 'light'

type Point = [number, number | null]

const HOUR_MS = 3_600_000
const GREEN = '#10B981'
const AMBER = '#F59E0B'

// ECharts dessine en SVG : il ne lit pas les variables CSS, d'où les valeurs
// recopiées de main.css pour les deux fonds de carte.
const PALETTES = {
  dark: { text: 'rgba(243,244,246,0.5)', grid: 'rgba(255,255,255,0.06)', capacity: 'rgba(255,255,255,0.35)', tooltip: '#1F2937', tooltipText: '#F3F4F6' },
  light: { text: 'rgba(0,0,0,0.45)', grid: 'rgba(0,0,0,0.07)', capacity: 'rgba(0,0,0,0.3)', tooltip: '#FFFFFF', tooltipText: '#1E293B' },
} as const

function kw(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kW`
}

// Graduation haute arrondie à un demi-ordre de grandeur, avec 10 % de marge
// pour que la courbe ne touche pas le bord.
function niceMax(value: number): number {
  const raw = Math.max(value, 1) * 1.1
  const step = 10 ** Math.floor(Math.log10(raw)) / 2
  return Math.ceil(raw / step) * step
}

function timeLabel(spanMs: number): string {
  return spanMs > 48 * HOUR_MS ? '{dd}/{MM}' : '{HH}:{mm}'
}

function markLine(name: string, value: number, color: string) {
  return {
    name,
    yAxis: value,
    lineStyle: { color, type: 'dashed' as const, width: 1.5 },
    label: { formatter: '{b}', position: 'insideEndTop' as const, color },
  }
}

function baseOption(tone: ChartTone, yMax: number, labelFormat: string): EChartsOption {
  const palette = PALETTES[tone]
  return {
    animation: false,
    grid: { left: 48, right: 16, top: 24, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltip,
      borderWidth: 0,
      textStyle: { color: palette.tooltipText, fontSize: 12 },
      valueFormatter: (value: unknown) => (typeof value === 'number' ? kw(value) : 'donnée manquante'),
    },
    xAxis: {
      type: 'time',
      axisLabel: { formatter: labelFormat, color: palette.text, fontFamily: 'monospace', hideOverlap: true },
      axisLine: { lineStyle: { color: palette.grid } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yMax,
      axisLabel: { color: palette.text, fontFamily: 'monospace', formatter: '{value} kW' },
      splitLine: { lineStyle: { color: palette.grid } },
    },
  }
}

function measured(readings: Reading[]): Point[] {
  return readings.map(r => [Date.parse(r.timestamp), r.consumption_kw])
}

function hasValue(point: Point): point is [number, number] {
  return point[1] != null
}

export function peakReading(readings: Reading[]): { kw: number; timestamp: number } | null {
  const [first, ...rest] = measured(readings).filter(hasValue)
  if (!first) return null
  const [timestamp, value] = rest.reduce((a, b) => (b[1] > a[1] ? b : a), first)
  return { kw: value, timestamp }
}

function dayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// Une plage choisie finit à minuit le lendemain de son dernier jour : c'est ce
// dernier jour qu'on annonce.
export function historyTitle(window: ChartWindow, range?: { from: string; to: string } | null): string {
  if (window === 'custom' && range) {
    const lastDay = new Date(Date.parse(range.to) - 1).toISOString()
    return `Historique de consommation, du ${dayMonth(range.from)} au ${dayMonth(lastDay)}`
  }
  return window === '24h'
    ? 'Historique de consommation, 24 dernières heures'
    : 'Historique de consommation, 7 derniers jours'
}

export function consumptionChartOption(input: {
  readings: Reading[]
  capacityKw: number | null
  thresholdKw: number | null
  window: ChartWindow
  tone: ChartTone
}): EChartsOption | null {
  const data = measured(input.readings)
  const values = data.filter(hasValue).map(p => p[1])
  if (!values.length) return null

  const palette = PALETTES[input.tone]
  const lines = []
  if (input.capacityKw) lines.push(markLine(`capacité ${kw(input.capacityKw)}`, input.capacityKw, palette.capacity))
  if (input.thresholdKw) lines.push(markLine(`seuil ${kw(input.thresholdKw)}`, input.thresholdKw, AMBER))

  const yMax = niceMax(Math.max(...values, input.capacityKw ?? 0, input.thresholdKw ?? 0))
  const times = data.map(p => p[0])
  let labelFormat = input.window === '24h' ? '{HH}:{mm}' : '{dd}/{MM}'
  // Une plage choisie s'étiquette selon sa durée réelle.
  if (input.window === 'custom') labelFormat = timeLabel(Math.max(...times) - Math.min(...times))

  const series: LineSeriesOption = {
    id: 'consumption',
    name: 'Consommation',
    type: 'line',
    data,
    connectNulls: false,
    showSymbol: false,
    lineStyle: { color: GREEN, width: 2 },
    itemStyle: { color: GREEN },
    areaStyle: { color: 'rgba(16,185,129,0.12)' },
    markLine: { symbol: 'none', silent: true, data: lines },
  }
  return { ...baseOption(input.tone, yMax, labelFormat), series: [series] }
}

function durationLabel(hours: number): string {
  return hours > 48 ? `${Math.round(hours / 24)} j` : `${hours} h`
}

export function predictionTitle(historical: Reading[], forecast: PredictionPoint[]): string {
  const times = historical.map(r => Date.parse(r.timestamp))
  const measuredHours = times.length ? Math.round((Math.max(...times) - Math.min(...times) + HOUR_MS) / HOUR_MS) : 0
  return `Mesuré (${durationLabel(measuredHours)}) puis prévu (${durationLabel(forecast.length)})`
}

export function predictionChartOption(input: {
  historical: Reading[]
  forecast: PredictionPoint[]
  thresholdKw: number | null
  tone: ChartTone
}): EChartsOption | null {
  const history = measured(input.historical)
  const lastMeasured = history.findLast(hasValue)
  if (!lastMeasured || !input.forecast.length) return null

  const predicted: Point[] = input.forecast.map(p => [Date.parse(p.timestamp), p.predicted_consumption_kw])
  const hasBand = input.forecast.every(p => p.confidence_lower != null && p.confidence_upper != null)

  const values = [
    ...history.filter(hasValue).map(p => p[1]),
    ...input.forecast.map(p => p.confidence_upper ?? p.predicted_consumption_kw),
    input.thresholdKw ?? 0,
  ]
  const firstTime = history[0]![0]
  const lastTime = predicted.at(-1)![0]

  const nowLine = {
    name: 'maintenant',
    xAxis: lastMeasured[0],
    lineStyle: { color: PALETTES[input.tone].capacity, type: 'dotted' as const },
    label: { formatter: '{b}', color: PALETTES[input.tone].text },
  }
  const lines: object[] = [nowLine]
  if (input.thresholdKw) lines.push(markLine(`seuil ${kw(input.thresholdKw)}`, input.thresholdKw, AMBER))

  const series: LineSeriesOption[] = [
    {
      id: 'historical',
      name: 'Mesuré',
      type: 'line',
      data: history,
      connectNulls: false,
      showSymbol: false,
      lineStyle: { color: GREEN, width: 2 },
      itemStyle: { color: GREEN },
      markLine: { symbol: 'none', silent: true, data: lines },
    },
    {
      id: 'forecast',
      name: 'Prévu',
      type: 'line',
      // Commence au dernier point mesuré : la courbe prévue prolonge la mesurée.
      data: [lastMeasured, ...predicted],
      showSymbol: false,
      lineStyle: { color: AMBER, width: 2, type: 'dashed' },
      itemStyle: { color: AMBER },
      markArea: {
        silent: true,
        itemStyle: { color: 'rgba(245,158,11,0.05)' },
        data: [[{ xAxis: lastMeasured[0] }, { xAxis: lastTime }]],
      },
    },
  ]

  if (hasBand) {
    // ECharts n'a pas de série « bande » : on empile une borne basse invisible
    // et l'écart jusqu'à la borne haute, seul remplis.
    const band = { type: 'line' as const, stack: 'confidence', showSymbol: false, lineStyle: { opacity: 0 }, tooltip: { show: false } }
    series.push(
      { ...band, id: 'band-lower', data: input.forecast.map(p => [Date.parse(p.timestamp), p.confidence_lower!]) },
      {
        ...band,
        id: 'band-width',
        data: input.forecast.map(p => [Date.parse(p.timestamp), p.confidence_upper! - p.confidence_lower!]),
        areaStyle: { color: 'rgba(245,158,11,0.15)' },
      },
    )
  }

  return {
    ...baseOption(input.tone, niceMax(Math.max(...values)), timeLabel(lastTime - firstTime)),
    series,
  }
}
