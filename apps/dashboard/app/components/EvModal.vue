<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    style="background: rgba(0,0,0,0.6)"
    @click.self="emit('close')"
  >
    <div
      role="dialog"
      class="bg-ev-surface-2 border border-ev-border rounded-ev-md p-6 w-full max-w-md flex flex-col gap-4"
    >
      <slot />
    </div>
  </div>
</template>
