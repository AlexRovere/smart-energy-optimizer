<script setup lang="ts">
import type { Recommendation } from '~/types/api'

defineProps<{ open: boolean; siteName: string; recommendations: Recommendation[] }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <EvModal :open="open" @close="emit('close')">
    <template v-if="open">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span class="font-ev-mono text-[11px] font-semibold tracking-widest text-ev-text-3">ALERTE DÉTECTÉE</span>
          <h3 class="font-ev text-base font-semibold">{{ siteName }}</h3>
        </div>
        <button data-testid="fermer-btn" class="font-ev text-ev-text-3 cursor-pointer" @click="emit('close')">✕</button>
      </div>

      <div v-for="recommendation in recommendations" :key="recommendation.recommendation_id" class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <EvSeverityTag :severity="recommendation.priority" />
          <span class="font-ev-mono text-[11px] text-ev-text-3">{{ recommendation.trigger.value_kw }} / {{ recommendation.trigger.threshold_kw }} kW</span>
        </div>
        <EvCorrectionAction :recommendation="recommendation" />
      </div>
    </template>
  </EvModal>
</template>
