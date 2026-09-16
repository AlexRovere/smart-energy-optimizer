<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'dark' | 'light'; pad?: number; radius?: number }>(), {
  tone: 'dark', pad: 22, radius: 16,
})
</script>

<template>
  <section
    class="flex flex-col gap-ev-3"
    :class="tone === 'dark'
      ? 'bg-ev-surface-2 border border-ev-border'
      : 'bg-ev-surface-light text-ev-ink-on-light'"
    :style="{ padding: pad + 'px', borderRadius: radius + 'px' }"
  >
    <header v-if="$slots.title || $slots.actions" class="flex items-start justify-between gap-ev-6">
      <div class="flex flex-col gap-1.5">
        <slot name="title" />
        <slot name="subtitle" />
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-ev-4 shrink-0">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>
