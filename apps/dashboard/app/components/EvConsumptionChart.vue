<script setup lang="ts">
import { computed, ref } from 'vue'
import VChart from 'vue-echarts'
import type { Reading } from '~/types/api'
import { consumptionChartOption, historyTitle, peakReading, type ChartWindow } from '~/utils/charts'
import { customRange, rangeError, type HistoryRange } from '~/utils/historyRange'

const props = defineProps<{
  readings: Reading[]
  capacityKw: number | null
  thresholdKw: number | null
  // Données disponibles dans le Parquet : bornes du choix de dates.
  firstDataAt?: string | null
  lastDataAt?: string | null
}>()
const chartWindow = defineModel<ChartWindow>('window', { required: true })
const range = defineModel<HistoryRange | null>('range', { default: null })

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

// Les champs de date travaillent en journées locales (AAAA-MM-JJ).
function localDay(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const minDay = computed(() => localDay(props.firstDataAt))
const maxDay = computed(() => localDay(props.lastDataAt))
const startDay = ref('')
const endDay = ref('')
const error = ref<string | null>(null)

function showRange() {
  error.value = rangeError(startDay.value, endDay.value)
  if (error.value) return
  range.value = customRange(startDay.value, endDay.value)
  chartWindow.value = 'custom'
}
</script>

<template>
  <EvCard>
    <template #title>
      <div class="flex items-start justify-between w-full gap-4 flex-wrap">
        <div>
          <span class="font-ev text-base font-semibold">{{ historyTitle(chartWindow, range) }}</span>
          <div v-if="peak" class="font-ev-mono text-[11px] text-ev-text-3 mt-0.5">{{ peak }}</div>
        </div>
        <div class="flex flex-col items-end gap-1.5 shrink-0">
          <div class="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              v-for="w in (['24h', '7j'] as const)"
              :key="w"
              class="font-ev-mono text-xs font-semibold px-3 py-1.5 rounded-ev-btn border transition-colors cursor-pointer"
              :style="chartWindow === w
                ? 'background: var(--ev-surface-2); border-color: var(--ev-border-hover); color: var(--ev-text)'
                : 'border-color: var(--ev-border); color: var(--ev-text-3)'"
              @click="chartWindow = w"
            >{{ w }}</button>
            <label class="font-ev text-xs text-ev-text-3 flex items-center gap-1.5 ml-2">
              du
              <input
                v-model="startDay"
                type="date"
                :min="minDay"
                :max="maxDay"
                aria-label="Début de la plage"
                class="font-ev-mono text-xs px-2 py-1 rounded-ev-btn border border-ev-border bg-transparent text-ev-text"
              >
            </label>
            <label class="font-ev text-xs text-ev-text-3 flex items-center gap-1.5">
              au
              <input
                v-model="endDay"
                type="date"
                :min="minDay"
                :max="maxDay"
                aria-label="Fin de la plage"
                class="font-ev-mono text-xs px-2 py-1 rounded-ev-btn border border-ev-border bg-transparent text-ev-text"
              >
            </label>
            <button
              class="font-ev-mono text-xs font-semibold px-3 py-1.5 rounded-ev-btn border transition-colors cursor-pointer"
              :style="chartWindow === 'custom'
                ? 'background: var(--ev-surface-2); border-color: var(--ev-border-hover); color: var(--ev-text)'
                : 'border-color: var(--ev-border); color: var(--ev-text-3)'"
              @click="showRange"
            >Afficher</button>
          </div>
          <output v-if="error" class="font-ev text-xs text-ev-amber">{{ error }}</output>
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
