<script setup lang="ts">
import type { DernierEntrainement } from '~/composables/useTraining'

const props = defineProps<{
  dernierEntrainement?: DernierEntrainement | null
  loading?: boolean
}>()

const emit = defineEmits<{
  déclencher: []
}>()

function formaterHeure(date: Date): string {
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
      @click="emit('déclencher')"
    >
      Entraîner le modèle
    </UButton>

    <div
      v-if="props.loading || props.dernierEntrainement"
      data-testid="training-badge"
      class="flex items-center gap-1.5 px-1"
    >
      <template v-if="props.loading">
        <span class="size-1.5 rounded-full shrink-0 bg-ev-amber" />
        <span class="font-ev-mono text-[10px] leading-none text-ev-text-muted">En cours</span>
      </template>
      <template v-else-if="props.dernierEntrainement">
        <span
          class="size-1.5 rounded-full shrink-0"
          :class="props.dernierEntrainement.statut === 'succès' ? 'bg-ev-green' : 'bg-ev-red'"
        />
        <span class="font-ev-mono text-[10px] leading-none text-ev-text-muted">
          {{ props.dernierEntrainement.statut === 'succès' ? 'Succès' : 'Erreur' }}
          · {{ formaterHeure(props.dernierEntrainement.à) }}
        </span>
      </template>
    </div>
  </div>
</template>
