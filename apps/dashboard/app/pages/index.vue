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
  refreshedAt,
  refreshFailed,
  refresh,
} = useFleetOverview()

const lastUpdate = computed(() => refreshLabel(refreshedAt.value, refreshFailed.value))

type AlertFilter = 'all' | AlertSeverity

const alertFilter = ref<AlertFilter>('all')
const toast = useToast()

function exporter() {
  toast.add({ title: 'Fonctionnalité non disponible dans cette version', color: 'warning' })
}

const filteredAlerts = computed(() =>
  alertFilter.value === 'all'
    ? alerts.value
    : alerts.value.filter(a => a.severity === alertFilter.value),
)

</script>

<template>
  <div class="flex flex-1 min-h-0 overflow-hidden">

    <!-- ── Contenu principal ───────────────────────────────────── -->
    <div class="flex-1 min-w-0 overflow-y-auto p-7 flex flex-col gap-6">

      <!-- Header -->
      <header class="flex items-start justify-between gap-4">
        <div>
          <h2 class="font-ev text-[28px] font-bold tracking-tight">Vue d'ensemble du parc</h2>
          <p class="font-ev text-sm mt-1" :class="refreshFailed ? 'text-ev-amber' : 'text-ev-text-2'">{{ lastUpdate }}</p>
        </div>
        <div class="flex gap-3 shrink-0 mt-1">
          <EvButton variant="secondary" @click="refresh()">Rafraîchir</EvButton>
          <EvButton data-testid="exporter-btn" variant="primary" @click="exporter()">Exporter le relevé</EvButton>
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
          :note="stats ? `${stats.sites_counted} sites sur ${stats.sites_total} · ${excludedSites.join(', ')} exclu` : ''"
          note-tone="amber"
        />
        <EvKpiCard
          label="CAPACITÉ TOTALE"
          :value="totalCapacityDisplay"
          unit="kW"
          :note="stats ? `Somme des capacités · ${stats.sites_total} sites actifs` : ''"
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

        <EvSitesTable
          :sites="siteSummary"
          clickable
          @select="navigateTo(`/sites/${$event.site_id}`)"
        />
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
