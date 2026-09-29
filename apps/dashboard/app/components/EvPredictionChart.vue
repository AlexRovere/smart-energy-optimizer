<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { PredictionPoint, Reading } from '~/types/api'
import { predictionChartOption, predictionTitle, type ChartTone } from '~/utils/charts'

const props = withDefaults(defineProps<{
  historicalPoints: Reading[]
  forecastPoints: PredictionPoint[]
  threshold: number
  confidenceLevel: number
  tone?: ChartTone
}>(), { tone: 'dark' })

const option = computed(() => predictionChartOption({
  historical: props.historicalPoints,
  forecast: props.forecastPoints,
  thresholdKw: props.threshold,
  tone: props.tone,
}))
const title = computed(() => predictionTitle(props.historicalPoints, props.forecastPoints))
const confidencePct = computed(() => Math.round(props.confidenceLevel * 100))
// Le modèle actuel ne fournit pas de bornes : pas de bande, donc pas de légende.
const hasBand = computed(() => props.forecastPoints.length > 0
  && props.forecastPoints.every(p => p.confidence_lower != null && p.confidence_upper != null))
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3 font-ev">
      <span class="text-sm font-semibold">{{ title }}</span>
      <span v-if="hasBand" class="text-xs opacity-60">bande = intervalle de confiance {{ confidencePct }} %</span>
    </div>

    <div v-if="option" data-testid="prediction-chart" class="h-65">
      <ClientOnly>
        <VChart :option="option" autoresize class="h-full w-full" />
      </ClientOnly>
    </div>

    <div v-else class="h-65 flex items-center justify-center text-sm opacity-50">
      Données insuffisantes
    </div>
  </div>
</template>
