<script setup lang="ts">
import type { ModelInfo } from '~/types/api'

const props = defineProps<{
  model?: ModelInfo | null
  available?: boolean
}>()

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="flex flex-col gap-2 p-3 border border-ev-border rounded-ev-btn">
    <span class="font-ev-mono text-[10px] font-medium tracking-[0.16em] text-ev-text-muted">MODÈLE ACTIF</span>

    <div
      v-if="!props.available"
      class="font-ev text-xs text-ev-text-muted"
    >
      Aucun modèle disponible
    </div>

    <template v-else-if="props.model">
      <div class="flex flex-col gap-0.5">
        <span
          data-testid="model-name"
          class="font-ev-mono text-[11px] font-medium text-ev-text"
        >{{ props.model.name }}</span>
        <span
          data-testid="model-version"
          class="font-ev-mono text-[10px] text-ev-text-muted"
        >v{{ props.model.version }} · {{ props.model.alias }}</span>
      </div>

      <div
        v-if="props.model.creation_timestamp"
        data-testid="model-date"
        class="font-ev-mono text-[10px] text-ev-text-muted"
      >
        Entraîné le {{ formatDate(props.model.creation_timestamp) }}
      </div>

      <div
        v-if="props.model.metriques?.training_rows"
        data-testid="model-metrics"
        class="font-ev-mono text-[10px] text-ev-text-muted"
      >
        {{ props.model.metriques.training_rows.toLocaleString('fr-FR') }} lignes d'entraînement
      </div>
    </template>
  </div>
</template>
