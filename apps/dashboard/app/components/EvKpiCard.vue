<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string
  unit?: string
  note?: string
  noteTone?: 'muted' | 'amber'
  progress?: number | null
}>(), { unit: undefined, note: undefined, noteTone: 'muted', progress: null })
</script>

<template>
  <div class="bg-ev-surface-2 border border-ev-border rounded-ev-lg p-5.5 flex flex-col gap-3.5">
    <span class="font-ev text-xs font-medium tracking-[0.06em] text-ev-text-3">{{ label }}</span>
    <div class="flex items-baseline gap-ev-2">
      <span class="font-ev text-[34px] font-bold leading-none tracking-tight">{{ value }}</span>
      <span v-if="unit" class="font-ev-mono text-sm font-medium text-ev-text-3">{{ unit }}</span>
    </div>
    <UProgress
      v-if="progress != null"
      :model-value="progress"
      color="primary"
      size="xs"
    />
    <span
      v-else-if="note"
      class="font-ev text-xs leading-snug"
      :class="noteTone === 'amber' ? 'text-ev-amber font-medium' : 'text-ev-text-3'"
    >
      {{ note }}
    </span>
  </div>
</template>
