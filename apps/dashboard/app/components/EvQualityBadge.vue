<script setup lang="ts">
import type { DataQuality } from '../types/api'
import { qualityHint, qualityLabel } from '../utils/labels'

const props = defineProps<{ quality: DataQuality }>()

const MAP = {
  good:     { color: 'primary' as const, variant: 'soft' as const },
  partial:  { color: 'warning' as const, variant: 'soft' as const },
  degraded: { color: 'warning' as const, variant: 'subtle' as const },
  critical: { color: 'error' as const,   variant: 'soft' as const },
} as const

const badge = computed(() => MAP[props.quality])
</script>

<template>
  <UBadge
    :label="qualityLabel(quality)"
    :title="qualityHint(quality)"
    :color="badge.color"
    :variant="badge.variant"
    size="xs"
    :ui="{
      base: 'font-ev-mono font-medium rounded-ev-xs',
    }"
  />
</template>
