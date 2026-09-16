<script setup lang="ts">
import type { SiteSummary } from '~/types/api'

const props = withDefaults(defineProps<{
  sites: SiteSummary[]
  clickable?: boolean
}>(), { clickable: false })

const emit = defineEmits<{ select: [site: SiteSummary] }>()

function chargeColor(pct: number | null): string {
  if (pct == null) return 'rgba(255,255,255,0.15)'
  if (pct >= 80) return 'var(--ev-red)'
  if (pct >= 50) return 'var(--ev-amber)'
  return 'var(--ev-green)'
}

function fmtLoad(pct: number | null): string {
  if (pct == null) return '—'
  return pct.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'
}

function fmtConso(kw: number | null): string {
  if (kw == null) return '—'
  return kw.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse min-w-140">
      <thead>
        <tr class="border-b" style="border-color: var(--ev-border)">
          <th class="text-left pb-3 pr-6 font-ev-mono text-[10px] font-semibold tracking-widest text-ev-text-3">SITE</th>
          <th class="text-right pb-3 pr-6 font-ev-mono text-[10px] font-semibold tracking-widest text-ev-text-3">CONSO.</th>
          <th class="text-right pb-3 pr-8 font-ev-mono text-[10px] font-semibold tracking-widest text-ev-text-3">CAPACITÉ</th>
          <th class="text-left pb-3 pr-8 font-ev-mono text-[10px] font-semibold tracking-widest text-ev-text-3">CHARGE</th>
          <th class="text-left pb-3 pr-4 font-ev-mono text-[10px] font-semibold tracking-widest text-ev-text-3">QUALITÉ</th>
          <th class="text-left pb-3 font-ev-mono text-[10px] font-semibold tracking-widest text-ev-text-3">SANTÉ</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="site in props.sites"
          :key="site.site_id"
          class="border-b last:border-0 transition-colors"
          :class="{ 'cursor-pointer': props.clickable }"
          style="border-color: var(--ev-border)"
          @click="props.clickable && emit('select', site)"
          @mouseenter="($event.currentTarget as HTMLElement).style.background = 'var(--ev-veil)'"
          @mouseleave="($event.currentTarget as HTMLElement).style.background = ''"
        >
          <td class="py-3.5 pr-6">
            <div class="font-ev text-sm font-semibold">{{ site.site_name }}</div>
            <div class="font-ev-mono text-[11px] text-ev-text-3 mt-0.5">
              {{ site.site_id }} · {{ site.site_type ?? '—' }}
            </div>
          </td>
          <td class="py-3.5 pr-6 text-right font-ev-mono text-sm">
            {{ fmtConso(site.current_consumption_kw) }}
          </td>
          <td class="py-3.5 pr-8 text-right font-ev-mono text-sm">
            {{ site.capacity_kw.toLocaleString('fr-FR') }}
          </td>
          <td class="py-3.5 pr-8">
            <div class="flex items-center gap-2.5">
              <div
                class="h-1.5 w-20 rounded-full overflow-hidden shrink-0"
                style="background: rgba(255,255,255,0.10)"
              >
                <div
                  class="h-full rounded-full"
                  :style="{
                    width: (site.load_percent ?? 0) + '%',
                    background: chargeColor(site.load_percent),
                    transition: 'width 0.3s ease',
                  }"
                />
              </div>
              <span class="font-ev-mono text-[11px] text-ev-text-2 whitespace-nowrap">
                {{ fmtLoad(site.load_percent) }}
              </span>
            </div>
          </td>
          <td class="py-3.5 pr-4">
            <EvQualityBadge :quality="site.data_quality" />
          </td>
          <td class="py-3.5">
            <EvHealthBadge :status="site.health" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
