<script setup lang="ts">
import type { AlertSeverity } from '../types/api'

const props = defineProps<{ severity: AlertSeverity }>()

const MAP = {
  low:      { color: 'neutral' as const, variant: 'soft' as const },
  medium:   { color: 'warning' as const, variant: 'soft' as const },
  high:     { color: 'warning' as const, variant: 'subtle' as const },
  critical: { color: 'error' as const,   variant: 'soft' as const },
} as const

const badge = computed(() => MAP[props.severity])
</script>

<template>
  <UBadge
    :label="severity.toUpperCase()"
    :color="badge.color"
    :variant="badge.variant"
    size="xs"
    :ui="{
      base: 'font-ev-mono tracking-widest font-medium rounded-ev-xs',
    }"
  />
</template>
