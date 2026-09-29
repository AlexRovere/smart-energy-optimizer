<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AlertThresholdType, AlertThresholdInput } from '~~/shared/alertThresholdSchema'

const props = defineProps<{
  open: boolean
  siteName: string
  type: AlertThresholdType
  initial: AlertThresholdInput
}>()
const emit = defineEmits<{ close: []; save: [AlertThresholdInput] }>()

const TYPE_LABEL = { conso: 'CONSO', pic: 'PIC' } as const
const THRESHOLD_LABEL = { conso: 'Seuil de déclenchement (kWh)', pic: 'Seuil de déclenchement (% de la moyenne glissante)' } as const

const displayedThreshold = ref(0)
const points = ref(0)

watch(() => props.open, open => {
  if (!open) return
  displayedThreshold.value = props.type === 'pic' ? props.initial.threshold * 100 : props.initial.threshold
  points.value = props.initial.duration
}, { immediate: true })

function validate() {
  const threshold = props.type === 'pic' ? displayedThreshold.value / 100 : displayedThreshold.value
  emit('save', { duration: points.value, threshold })
}
</script>

<template>
  <EvModal :open="open" @close="emit('close')">
    <template v-if="open">
      <div class="flex flex-col gap-1">
        <span class="font-ev-mono text-[11px] font-semibold tracking-widest text-ev-text-3">{{ TYPE_LABEL[type] }}</span>
        <h3 class="font-ev text-base font-semibold">{{ siteName }}</h3>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="font-ev text-xs text-ev-text-3">{{ THRESHOLD_LABEL[type] }}</span>
        <input
          v-model.number="displayedThreshold"
          data-testid="threshold-input"
          type="number"
          class="font-ev-mono text-sm bg-ev-surface border border-ev-border rounded-ev-btn px-3 py-2"
        >
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="font-ev text-xs text-ev-text-3">Nombre de points pris en compte (heures glissantes)</span>
        <input
          v-model.number="points"
          data-testid="points-input"
          type="number"
          class="font-ev-mono text-sm bg-ev-surface border border-ev-border rounded-ev-btn px-3 py-2"
        >
      </label>

      <EvButton data-testid="validate-btn" variant="primary" block @click="validate">Valider</EvButton>
    </template>
  </EvModal>
</template>
