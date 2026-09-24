<script setup lang="ts">
import type { Alert } from '../types/api'

const props = defineProps<{ alert: Alert }>()
const toast = useToast()

function acquitter() {
  toast.add({ title: 'Fonctionnalité non disponible dans cette version', color: 'warning' })
}

const EDGE = {
  low: 'var(--ev-text-2)', medium: 'var(--ev-amber)',
  high: 'var(--ev-amber-dark)', critical: 'var(--ev-red)',
} as const

const edge = computed(() => EDGE[props.alert.severity] ?? 'var(--ev-text-2)')
const time = computed(() =>
  new Date(props.alert.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
const values = computed(() => {
  const { value, threshold } = props.alert
  if (value == null) return ''
  return threshold == null ? `${value} kW` : `${value} / ${threshold} kW`
})
</script>

<template>
  <article
    class="bg-ev-surface-2 border border-ev-border border-l-[3px] rounded-ev-md p-3.5 flex flex-col gap-2.25 transition-colors duration-120 ease-out hover:border-[rgba(243,244,246,0.20)]"
    :style="{ borderLeftColor: edge }"
  >
    <div class="flex items-center justify-between gap-ev-2">
      <div class="flex items-center gap-1.75">
        <EvSeverityTag :severity="alert.severity" />
        <span class="font-ev-mono text-[10px] font-semibold leading-none tracking-[0.12em] text-ev-text-2">
          {{ alert.type.toUpperCase() }}
        </span>
      </div>
      <span class="font-ev-mono text-[11px] leading-none text-ev-text-muted">{{ time }}</span>
    </div>
    <p class="m-0 font-ev text-[13px] font-semibold leading-snug text-pretty">{{ alert.message }}</p>
    <div class="flex items-center justify-between gap-ev-2">
      <span class="font-ev-mono text-[11px] leading-none text-ev-text-4">{{ alert.site_id }}</span>
      <span class="font-ev-mono text-[11px] font-medium leading-none text-[rgba(243,244,246,0.7)]">{{ values }}</span>
    </div>
    <EvButton data-testid="acquitter-btn" variant="secondary" block @click="acquitter()">Acquitter</EvButton>
  </article>
</template>
