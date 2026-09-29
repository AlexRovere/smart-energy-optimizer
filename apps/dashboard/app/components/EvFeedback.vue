<script setup lang="ts">
// Avis de l'exploitant sur une recommandation ou une prévision (#47).
defineProps<{ current: boolean | null }>()
const emit = defineEmits<{ vote: [useful: boolean] }>()

const OPTIONS = [
  { useful: true, label: 'Utile', icon: 'i-heroicons-hand-thumb-up' },
  { useful: false, label: 'Pas utile', icon: 'i-heroicons-hand-thumb-down' },
] as const
</script>

<template>
  <div class="flex items-center gap-1.5" role="group" aria-label="Cette information vous a-t-elle servi ?">
    <button
      v-for="option in OPTIONS"
      :key="option.label"
      type="button"
      :aria-pressed="current === option.useful"
      class="font-ev text-[11px] px-2 py-1 rounded-ev-btn border transition-colors cursor-pointer flex items-center gap-1"
      :style="current === option.useful
        ? 'background: var(--ev-surface-2); border-color: var(--ev-border-hover); color: var(--ev-text)'
        : 'border-color: var(--ev-border); color: var(--ev-text-3)'"
      @click="emit('vote', option.useful)"
    >
      <UIcon :name="option.icon" class="size-3.5" />
      {{ option.label }}
    </button>
  </div>
</template>
