<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  value: string
  unit?: string
  note?: string
  ratio: number | null
  color?: string
}>(), { unit: undefined, note: undefined, color: 'var(--ev-green)' })

const C = 2 * Math.PI * 54
const dash = computed(() => {
  const r = props.ratio == null ? 0 : Math.max(0, Math.min(1, props.ratio))
  return `${(r * C).toFixed(1)} ${C.toFixed(1)}`
})
</script>

<template>
  <div class="bg-ev-surface-2 border border-ev-border rounded-ev-lg p-5 flex items-center gap-4.5">
    <svg class="shrink-0" width="96" height="96" viewBox="0 0 128 128" aria-hidden="true">
      <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(243,244,246,.1)" stroke-width="10" />
      <circle
        cx="64" cy="64" r="54" fill="none" :stroke="color" stroke-width="10"
        stroke-linecap="round" :stroke-dasharray="dash" transform="rotate(-90 64 64)"
      />
    </svg>
    <div class="flex flex-col gap-ev-2 min-w-0">
      <span class="font-ev text-xs font-medium leading-none tracking-[0.06em] text-ev-text-3">{{ label }}</span>
      <div class="flex items-baseline gap-1.5">
        <span class="font-ev text-2xl font-bold leading-none" :style="{ color }">{{ value }}</span>
        <span v-if="unit" class="font-ev-mono text-xs font-medium text-ev-text-4">{{ unit }}</span>
      </div>
      <span v-if="note" class="font-ev text-[11px] leading-snug text-ev-text-4">{{ note }}</span>
    </div>
  </div>
</template>
