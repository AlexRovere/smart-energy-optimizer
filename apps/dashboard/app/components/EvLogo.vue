<script setup lang="ts">
withDefaults(defineProps<{ size?: number; wordmark?: boolean; tagline?: boolean }>(), {
  size: 32, wordmark: true, tagline: true,
})
</script>

<template>
  <div class="flex items-center gap-2.5">
    <svg :width="size * 30 / 34" :height="size" viewBox="0 0 30 34" role="img" aria-label="EnerVision">
      <polygon
        points="15,1.2 28.4,8.9 28.4,24.4 15,32.1 1.6,24.4 1.6,8.9"
        fill="none" stroke="rgba(243,244,246,.38)" stroke-width="1.4"
      />
      <polyline
        points="5.5,20 9.5,16.5 13,21 17,13.5 21,26.5 25,11.5"
        fill="none" stroke="#10B981" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"
      />
    </svg>
    <div v-if="wordmark" class="flex flex-col gap-0.5">
      <span class="font-ev text-[15px] font-bold leading-none tracking-tight">EnerVision</span>
      <span v-if="tagline" class="font-ev-mono text-[9px] font-medium leading-none tracking-[0.14em] text-[rgba(243,244,246,0.38)]">
        SMART ENERGY
      </span>
    </div>
  </div>
</template>
