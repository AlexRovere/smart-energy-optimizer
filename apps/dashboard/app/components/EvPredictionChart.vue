<script setup lang="ts">
import { computed } from 'vue'
import type { PredictionPoint, Reading } from '~/types/api'

const props = defineProps<{
  historicalPoints: Reading[]
  forecastPoints: PredictionPoint[]
  threshold: number
  confidenceLevel: number
}>()

const W = 880
const H = 280
const PAD_T = 20
const PAD_R = 16
const PAD_B = 40
const PAD_L = 48
const chartW = W - PAD_L - PAD_R
const chartH = H - PAD_T - PAD_B

const chart = computed(() => {
  const hist = props.historicalPoints.filter(r => r.consumption_kw != null)
  const fore = props.forecastPoints
  if (!hist.length || !fore.length) return null

  const total = hist.length + fore.length
  const allValues = [
    ...hist.map(r => r.consumption_kw!),
    ...fore.flatMap(p => p.confidence_upper != null ? [p.confidence_upper] : [p.predicted_consumption_kw]),
    props.threshold,
  ]
  const maxVal = Math.max(...allValues) * 1.15
  const yTicks = [0, 100, 200, 300, 400].filter(v => v <= maxVal + 50)

  function sx(i: number) { return PAD_L + (i / (total - 1)) * chartW }
  function sy(v: number) { return PAD_T + (1 - v / maxVal) * chartH }

  // Historical line
  const histPoints = hist.map((r, i) => ({ x: sx(i), y: sy(r.consumption_kw!) }))
  const histPath = histPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  // Forecast line (picks up from last historical index)
  const foreOffset = hist.length
  const forePoints = fore.map((p, i) => ({ x: sx(foreOffset + i), y: sy(p.predicted_consumption_kw) }))
  const forePath = forePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  // Confidence band (closed polygon: upper forward, lower backward) — optionnelle
  const hasBand = fore.every(p => p.confidence_upper != null && p.confidence_lower != null)
  const upper = fore.map((p, i) => ({ x: sx(foreOffset + i), y: sy(p.confidence_upper ?? 0) }))
  const lower = fore.map((p, i) => ({ x: sx(foreOffset + i), y: sy(p.confidence_lower ?? 0) })).reverse()
  const bandPath = hasBand ? [
    ...upper.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    ...lower.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    'Z',
  ].join(' ') : ''

  // Threshold line y
  const thrY = sy(props.threshold)

  // Separator x (between last historical and first forecast)
  const sepX = sx(hist.length - 1)

  // X-axis labels: every 4 historical points + "+2h", "+6h" forecast markers
  const xLabels = hist
    .map((r, i) => ({ x: sx(i), label: new Date(r.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }))
    .filter((_, i) => i % 4 === 0)
  const foreLabels = [
    { x: sx(foreOffset + 1), label: '+2 h' },
    { x: sx(foreOffset + fore.length - 1), label: `+${props.forecastPoints.length} h` },
  ]

  const baselineY = PAD_T + chartH

  return { histPath, forePath, bandPath, hasBand, thrY, sepX, xLabels, foreLabels, yTicks, sy, baselineY, chartW }
})

const confidencePct = computed(() => Math.round(props.confidenceLevel * 100))
</script>

<template>
  <div>
    <!-- Chart header -->
    <div class="flex items-center justify-between mb-3">
      <span class="font-ev text-sm font-semibold" style="color: var(--ev-ink-on-light, #1e293b)">
        Mesuré (24 h) puis prévu (6 h)
      </span>
      <span class="font-ev text-xs" style="color: rgba(0,0,0,0.4)">
        bande = intervalle de confiance {{ confidencePct }} %
      </span>
    </div>

    <!-- SVG -->
    <svg
      v-if="chart"
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full"
      style="height: 260px"
      preserveAspectRatio="none"
    >
      <!-- Forecast background zone -->
      <rect
        :x="chart.sepX"
        :y="PAD_T"
        :width="W - PAD_R - chart.sepX"
        :height="chartH"
        fill="rgba(245,158,11,0.05)"
      />

      <!-- Y gridlines + labels -->
      <g v-for="tick in chart.yTicks" :key="tick">
        <line
          :x1="PAD_L" :y1="chart.sy(tick).toFixed(1)"
          :x2="W - PAD_R" :y2="chart.sy(tick).toFixed(1)"
          stroke="rgba(0,0,0,0.07)" stroke-width="1"
        />
        <text
          :x="PAD_L - 6" :y="chart.sy(tick) + 4"
          text-anchor="end" font-size="11"
          fill="rgba(0,0,0,0.35)" font-family="monospace"
        >{{ tick }}</text>
      </g>

      <!-- Threshold line -->
      <line
        data-testid="threshold-line"
        :x1="PAD_L" :y1="chart.thrY.toFixed(1)"
        :x2="W - PAD_R" :y2="chart.thrY.toFixed(1)"
        stroke="var(--ev-amber)" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"
      />

      <!-- Confidence band (uniquement si les bornes sont présentes) -->
      <path
        v-if="chart.hasBand"
        data-testid="confidence-band"
        :d="chart.bandPath"
        fill="rgba(245,158,11,0.15)"
      />

      <!-- Historical line -->
      <path
        data-testid="historical-line"
        :d="chart.histPath"
        fill="none"
        stroke="var(--ev-green)"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Forecast line (dashed) -->
      <path
        data-testid="forecast-line"
        :d="chart.forePath"
        fill="none"
        stroke="var(--ev-amber)"
        stroke-width="2"
        stroke-dasharray="5 3"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Vertical separator "now" -->
      <line
        :x1="chart.sepX.toFixed(1)" :y1="PAD_T"
        :x2="chart.sepX.toFixed(1)" :y2="chart.baselineY"
        stroke="rgba(0,0,0,0.15)" stroke-width="1" stroke-dasharray="3 3"
      />

      <!-- X-axis historical labels -->
      <text
        v-for="lbl in chart.xLabels" :key="lbl.label"
        :x="lbl.x.toFixed(1)" :y="H - 8"
        text-anchor="middle" font-size="11"
        fill="rgba(0,0,0,0.4)" font-family="monospace"
      >{{ lbl.label }}</text>

      <!-- X-axis forecast labels -->
      <text
        v-for="lbl in chart.foreLabels" :key="lbl.label"
        :x="lbl.x.toFixed(1)" :y="H - 8"
        text-anchor="middle" font-size="11"
        fill="rgba(245,158,11,0.7)" font-family="monospace"
      >{{ lbl.label }}</text>
    </svg>

    <div v-else class="h-65 flex items-center justify-center text-sm" style="color: rgba(0,0,0,0.3)">
      Données insuffisantes
    </div>
  </div>
</template>
