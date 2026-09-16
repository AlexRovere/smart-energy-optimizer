<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'accent' | 'danger'
  disabled?: boolean
  block?: boolean
}>(), { variant: 'secondary', disabled: false, block: false })

const VARIANT_MAP = {
  primary:   { color: 'primary' as const, variant: 'solid' as const },
  secondary: { color: 'neutral' as const, variant: 'outline' as const },
  accent:    { color: 'warning' as const, variant: 'soft' as const },
  danger:    { color: 'error' as const,   variant: 'outline' as const },
} as const

const mapped = computed(() => VARIANT_MAP[props.variant])
</script>

<template>
  <UButton
    :color="mapped.color"
    :variant="mapped.variant"
    :disabled="disabled"
    :block="block"
    :size="block ? 'lg' : 'md'"
    :ui="{
      base: 'rounded-ev-btn font-semibold cursor-pointer',
    }"
  >
    <slot />
  </UButton>
</template>
