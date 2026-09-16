<script setup lang="ts">
import type { SensorHealth } from '../types/api'

const props = defineProps<{ status: SensorHealth | 'failing'; label?: string }>()

const MAP = {
  ok:       { color: 'primary' as const, variant: 'subtle' as const },
  degraded: { color: 'warning' as const, variant: 'subtle' as const },
  critical: { color: 'error' as const,   variant: 'subtle' as const },
  failing:  { color: 'neutral' as const, variant: 'subtle' as const },
} as const

const badge = computed(() => MAP[props.status])
</script>

<template>
  <UBadge
    :label="label ?? status"
    :color="badge.color"
    :variant="badge.variant"
    size="sm"
    :ui="{
      base: 'font-ev font-medium rounded-ev-sm gap-1.75',
    }"
  >
    <template #leading>
      <span
        class="size-1.75 rounded-full shrink-0"
        :class="[
          status === 'ok' && 'bg-ev-green',
          status === 'degraded' && 'bg-ev-amber',
          status === 'critical' && 'bg-ev-red animate-[ev-pulse-dot_1.6s_ease-in-out_infinite]',
          status === 'failing' && 'bg-ev-text-2',
        ]"
      />
    </template>
  </UBadge>
</template>
