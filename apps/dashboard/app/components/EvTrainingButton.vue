<script setup lang="ts">
import type { LastTraining } from '~/composables/useTraining'

const props = defineProps<{
  lastTraining?: LastTraining | null
  loading?: boolean
}>()

const emit = defineEmits<{
  trigger: []
}>()

function formatHour(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <UButton
      data-testid="training-trigger"
      icon="i-heroicons-cpu-chip"
      variant="soft"
      color="primary"
      size="sm"
      class="w-full justify-start"
      :loading="props.loading"
      :disabled="props.loading"
      @click="emit('trigger')"
    >
      Entraîner le modèle
    </UButton>

    <div
      v-if="props.loading || props.lastTraining"
      data-testid="training-badge"
      class="flex items-center gap-1.5 px-1"
    >
      <template v-if="props.loading">
        <span class="size-1.5 rounded-full shrink-0 bg-ev-amber" />
        <span class="font-ev-mono text-[10px] leading-none text-ev-text-muted">En cours</span>
      </template>
      <template v-else-if="props.lastTraining">
        <span
          class="size-1.5 rounded-full shrink-0"
          :class="props.lastTraining.status === 'success' ? 'bg-ev-green' : 'bg-ev-red'"
        />
        <span class="font-ev-mono text-[10px] leading-none text-ev-text-muted">
          {{ props.lastTraining.status === 'success' ? 'Succès' : 'Erreur' }}
          · {{ formatHour(props.lastTraining.finishedAt) }}
        </span>
      </template>
    </div>
  </div>
</template>
