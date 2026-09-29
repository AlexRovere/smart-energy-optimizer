<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { Reading } from '~/types/api'
import { consumptionChartOption, historyTitle, peakReading, type ChartWindow } from '~/utils/charts'

const props = defineProps<{
  readings: Reading[]
  capacityKw: number | null
  thresholdKw: number | null
}>()
const chartWindow = defineModel<ChartWindow>('window', { required: true })

const option = computed(() => consumptionChartOption({
  readings: props.readings,
  capacityKw: props.capacityKw,
  thresholdKw: props.thresholdKw,
  window: chartWindow.value,
  tone: 'dark',
}))

const peak = computed(() => {
  const found = peakReading(props.readings)
  if (!found) return null
  const moment = new Date(found.timestamp).toLocaleString('fr-FR', chartWindow.value === '24h'
    ? { hour: '2-digit', minute: '2-digit' }
    : { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `pic mesuré ${found.kw.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kW, ${moment}`
})
</script>

<template>
  <EvCard>
    <template #title>
      <div class="flex items-center justify-between w-full">
        <div>
          <span class="font-ev text-base font-semibold">{{ historyTitle(chartWindow) }}</span>
          <div v-if="peak" class="font-ev-mono text-[11px] text-ev-text-3 mt-0.5">{{ peak }}</div>
        </div>
        <div class="flex gap-1.5 shrink-0">
          <button
            v-for="w in (['24h', '7j'] as const)"
            :key="w"
            class="font-ev-mono text-xs font-semibold px-3 py-1.5 rounded-ev-btn border transition-colors cursor-pointer"
            :style="chartWindow === w
              ? 'background: var(--ev-surface-2); border-color: var(--ev-border-hover); color: var(--ev-text)'
              : 'border-color: var(--ev-border); color: var(--ev-text-3)'"
            @click="chartWindow = w"
          >{{ w }}</button>
        </div>
      </div>
    </template>

    <div v-if="option" data-testid="consumption-chart" class="mt-2 h-70">
      <ClientOnly>
        <VChart :option="option" autoresize class="h-full w-full" />
      </ClientOnly>
    </div>
    <div v-else class="py-10 text-center font-ev text-sm text-ev-text-3">
      Aucune donnée historique disponible
    </div>
  </EvCard>
</template>
