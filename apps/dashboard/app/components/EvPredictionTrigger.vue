<script setup lang="ts">
const props = defineProps<{
  siteId: string
  launched?: boolean
  pending?: boolean
  available?: boolean
  predictedAt?: string | null
  nbPoints?: number
  modelVersion?: string | null
  durationMs?: number | null
}>()

const emit = defineEmits<{
  launch: []
}>()

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div class="flex flex-col gap-1.5 items-end">
    <div class="flex items-center gap-2.5">
      <span class="font-ev-mono text-[10px] text-ev-text-3 hidden sm:inline">
        POST /api/sites/{{ props.siteId }}/prediction
      </span>
      <UButton
        data-testid="prediction-trigger"
        icon="i-heroicons-sparkles"
        size="xs"
        color="primary"
        :loading="props.pending"
        :disabled="props.pending"
        @click="emit('launch')"
      >
        {{ props.launched ? 'Relancer' : 'Lancer la prédiction' }}
      </UButton>
    </div>

    <div
      v-if="props.launched"
      data-testid="prediction-result"
      class="flex items-center gap-1.5 font-ev-mono text-[10px] leading-none text-ev-text-muted"
    >
      <template v-if="props.pending">
        <span class="size-1.5 rounded-full shrink-0 bg-ev-amber" />
        Calcul en cours…
      </template>
      <template v-else-if="props.available === false">
        <span class="size-1.5 rounded-full shrink-0 bg-ev-red" />
        Service de prédiction indisponible
        <template v-if="props.durationMs != null">· {{ props.durationMs }} ms</template>
      </template>
      <template v-else>
        <span class="size-1.5 rounded-full shrink-0 bg-ev-green" />
        {{ props.nbPoints ?? 0 }} points
        <template v-if="props.modelVersion">· v{{ props.modelVersion }}</template>
        <template v-if="props.predictedAt">· {{ formatHour(props.predictedAt) }}</template>
        <template v-if="props.durationMs != null">· {{ props.durationMs }} ms</template>
      </template>
    </div>
  </div>
</template>
