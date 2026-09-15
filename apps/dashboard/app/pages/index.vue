<script setup lang="ts">
import type { AlertSeverity } from '../types/api'

const {
  stats,
  totalConsumptionDisplay,
  totalCapacityDisplay,
  avgLoadDisplay,
  loadPercent,
  hasIncompleteData,
  excludedSites,
  siteSummary,
  sitesOkCount,
  sitesDegradedCount,
  sitesCriticalCount,
  alerts,
  alertsByLevel,
} = useFleetOverview()

const lastUpdate = computed(() => {
  if (!stats.value?.timestamp) return ''
  return new Date(stats.value.timestamp).toLocaleString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit',
  })
})

type AlertFilter = 'all' | AlertSeverity

const alertFilter = ref<AlertFilter>('all')

const filteredAlerts = computed(() =>
  alertFilter.value === 'all'
    ? alerts.value
    : alerts.value.filter(a => a.severity === alertFilter.value),
)

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
  if (kw == null) return '— null'
  return kw.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="flex flex-1 min-h-0 overflow-hidden">

    <!-- ── Contenu principal ───────────────────────────────────── -->
    <div class="flex-1 min-w-0 overflow-y-auto p-7 flex flex-col gap-6">

      <!-- Header -->
      <header class="flex items-start justify-between gap-4">
        <div>
          <h2 class="font-ev text-[28px] font-bold tracking-tight">Vue d'ensemble du parc</h2>
          <p class="font-ev text-sm text-ev-text-2 mt-1">stats/summary · timestamp {{ lastUpdate }}</p>
        </div>
        <div class="flex gap-3 shrink-0 mt-1">
          <EvButton variant="secondary">Rafraîchir</EvButton>
          <EvButton variant="primary">Exporter le relevé</EvButton>
        </div>
      </header>

      <!-- Bannière données incomplètes -->
      <div
        v-if="hasIncompleteData"
        class="flex items-center gap-2.5 px-4 py-3 rounded-ev-md border text-sm font-ev"
        style="border-color: var(--ev-amber-bd); background: var(--ev-amber-bg); color: var(--ev-amber)"
      >
        <span class="text-base leading-none shrink-0">⚠</span>
        <span>
          Données incomplètes — {{ stats?.sites_counted }} sites sur {{ stats?.sites_total }}
          · {{ excludedSites.join(', ') }} exclu{{ excludedSites.length > 1 ? 's' : '' }}
          (consumption_kw null)
        </span>
      </div>

      <!-- KPI cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-(--ev-gap-card)">
        <EvKpiCard
          label="CONSOMMATION TOTALE"
          :value="totalConsumptionDisplay"
          unit="kW"
          :note="`${stats?.sites_counted} sites sur ${stats?.sites_total} · ${excludedSites.join(', ')} exclu`"
          note-tone="amber"
        />
        <EvKpiCard
          label="CAPACITÉ TOTALE"
          :value="totalCapacityDisplay"
          unit="kW"
          :note="`Somme des capacity_kw · ${stats?.sites_total} sites actifs`"
          note-tone="muted"
        />
        <EvKpiCard
          label="CHARGE MOYENNE DU PARC"
          :value="avgLoadDisplay"
          unit="%"
          :progress="loadPercent"
        />
      </div>

      <!-- Tableau des sites -->
      <EvCard>
        <template #title>
          <span class="font-ev text-base font-semibold">Sites ({{ stats?.sites_total ?? 0 }})</span>
        </template>
        <template #subtitle>
          <div class="flex gap-3 font-ev-mono text-xs">
            <span style="color: var(--ev-green)">{{ sitesOkCount }} ok</span>
            <span style="color: var(--ev-amber)">{{ sitesDegradedCount }} degraded</span>
            <span style="color: var(--ev-red)">{{ sitesCriticalCount }} critical</span>
          </div>
        </template>

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
                v-for="site in siteSummary"
                :key="site.site_id"
                class="border-b last:border-0 transition-colors"
                style="border-color: var(--ev-border)"
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
      </EvCard>

    </div>

    <!-- ── Panneau droit : Alertes actives ────────────────────── -->
    <aside
      class="w-85 shrink-0 flex flex-col overflow-hidden"
      style="border-left: 1px solid var(--ev-border)"
    >
      <!-- En-tête -->
      <div class="p-5 pb-0 flex items-center justify-between gap-3">
        <h3 class="font-ev text-base font-semibold">Alertes actives</h3>
        <UBadge
          :label="String(alerts.length)"
          color="warning"
          variant="solid"
          :ui="{ base: 'font-ev-mono font-bold rounded-full min-w-5.5 justify-center' }"
        />
      </div>

      <!-- Filtres par niveau -->
      <div class="px-5 pt-3 pb-4 flex gap-1.5 flex-wrap">
        <button
          class="font-ev-mono text-[11px] font-semibold px-2.5 py-1 rounded-ev-pill border transition-colors cursor-pointer"
          :style="alertFilter === 'all'
            ? 'background: var(--ev-green); color: var(--ev-on-green); border-color: var(--ev-green)'
            : 'border-color: var(--ev-border); color: var(--ev-text-2)'"
          @click="alertFilter = 'all'"
        >
          Tous
        </button>
        <button
          v-for="sev in (['critical', 'high', 'medium', 'low'] as AlertSeverity[])"
          :key="sev"
          class="font-ev-mono text-[11px] font-semibold px-2.5 py-1 rounded-ev-pill border transition-colors cursor-pointer"
          :style="alertFilter === sev
            ? 'background: var(--ev-surface-2); border-color: var(--ev-border-hover); color: var(--ev-text)'
            : 'border-color: var(--ev-border); color: var(--ev-text-2)'"
          @click="alertFilter = sev"
        >
          {{ sev }} {{ alertsByLevel?.[sev] ?? '' }}
        </button>
      </div>

      <!-- Liste des alertes -->
      <div class="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-3">
        <EvAlertCard
          v-for="a in filteredAlerts"
          :key="a.alert_id"
          :alert="a"
        />
        <p
          v-if="!filteredAlerts.length"
          class="font-ev text-sm text-ev-text-3 py-8 text-center"
        >
          Aucune alerte pour ce niveau
        </p>
      </div>
    </aside>

  </div>
</template>
