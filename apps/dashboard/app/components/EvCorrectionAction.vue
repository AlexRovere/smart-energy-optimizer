<script setup lang="ts">
import type { Recommendation } from '~/types/api'

defineProps<{ recommendation: Recommendation }>()
const toast = useToast()

function appliquer() {
  toast.add({ title: 'Fonctionnalité non disponible dans cette version', color: 'warning' })
}
</script>

<template>
  <div class="flex items-center gap-4 py-4 border-b border-ev-border last:border-0">
    <!-- Texte -->
    <div class="flex-1 min-w-0">
      <p class="font-ev text-sm font-semibold text-ev-text">{{ recommendation.title }}</p>
      <p class="font-ev text-xs text-ev-text-3 mt-0.5">{{ recommendation.description }}</p>
    </div>

    <!-- Gain + confiance -->
    <div class="shrink-0 text-right font-ev-mono">
      <p class="text-sm font-bold" style="color: var(--ev-red)">
        {{ recommendation.gain_kw }} <span class="text-xs font-normal text-ev-text-3">kW</span>
      </p>
      <p class="text-xs text-ev-text-3">{{ recommendation.confidence.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
    </div>

    <!-- Bouton -->
    <EvButton data-testid="apply-btn" class="shrink-0" variant="primary" @click="appliquer()">Appliquer</EvButton>
  </div>
</template>
