<script setup lang="ts">
import type { AlertSeverity } from '~/types/api';

const router = useRouter()

const { sites, getSiteAlerts } = useSites()
const { stats } = useFleetOverview()

const lastUpdate = computed(() => {
  if (!stats.value) return
  return new Date(stats.value.timestamp).toLocaleDateString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit'
  })
})

const sitesOk = computed(() => sites.value.filter(s => s.health === 'ok').length)
const sitesDegraded = computed(() => sites.value.filter(s => s.health === 'degraded').length)
const sitesCritical = computed(() => sites.value.filter(s => s.health === 'critical').length)

const allAlerts = computed(() => sites.value.flatMap(s => getSiteAlerts(s.site_id)))

type AlertFilter = 'all' | AlertSeverity
const alertFilter = ref<AlertFilter>('all')

const filteredAlerts = computed(() =>
  alertFilter.value === 'all'
    ? allAlerts.value
    : allAlerts.value.filter(a => a.severity === alertFilter.value)
)

const alertsByLevel = computed(() => {
  const counts: Record<AlertSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const a of allAlerts.value) {
    counts[a.severity]++
  }
  return counts
})

</script>


<template>
  <div class="flex flex-1 min-h-0 overflow-hidden">

    <!-- ── Contenu principal ───────────────────────────────────── -->
    <div class="flex-1 min-w-0 overflow-y-auto p-7 flex flex-col gap-6">

      <!-- Header -->
      <header class="flex items-start justify-between gap-4">
        <div>
          <h2 class="font-ev text-[28px] font-bold tracking-tight">Sites et capteurs</h2>
          <p class="font-ev text-sm text-ev-text-2 mt-1">sites/summary · timestamp {{ lastUpdate }}</p>
        </div>
        <div class="flex gap-3 shrink-0 mt-1">
          <EvButton variant="secondary">Rafraîchir</EvButton>
        </div>
      </header>

      <!-- KPI cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-(--ev-gap-card)">
        <EvKpiCard
          label="TOTAL SITES"
          :value="String(sites.length)"
          unit="sites"
          note="Parc complet"
          note-tone="muted"
        />
        <EvKpiCard
          label="SITES EN LIGNE"
          :value="String(sitesOk)"
          unit="sites"
          :note="`${sitesDegraded} dégradé${sitesDegraded > 1 ? 's' : ''}`"
          note-tone="amber"
        />
        <EvKpiCard
          label="ALERTES ACTIVES"
          :value="String(allAlerts.length)"
          unit="alertes"
          :note="`dont ${alertsByLevel.critical} critique${alertsByLevel.critical > 1 ? 's' : ''}`"
          :note-tone="alertsByLevel.critical > 0 ? 'amber' : 'muted'"
        />
      </div>

      <!-- Tableau des sites -->
      <EvCard>
        <template #title>
          <span class="font-ev text-base font-semibold">Sites ({{ sites.length }})</span>
        </template>
        <template #subtitle>
          <div class="flex gap-3 font-ev-mono text-xs">
            <span style="color: var(--ev-green)">{{ sitesOk }} ok</span>
            <span style="color: var(--ev-amber)">{{ sitesDegraded }} degraded</span>
            <span style="color: var(--ev-red)">{{ sitesCritical }} critical</span>
          </div>
        </template>

        <EvSitesTable
          :sites="sites"
          clickable
          @select="router.push(`/sites/${$event.site_id}`)"
        />
      </EvCard>

    </div>

    <!-- ── Panneau droit : Alertes ────────────────────────────── -->
    <aside
      class="w-85 shrink-0 flex flex-col overflow-hidden"
      style="border-left: 1px solid var(--ev-border)"
    >
      <div class="p-5 pb-0 flex items-center justify-between gap-3">
        <h3 class="font-ev text-base font-semibold">Alertes actives</h3>
        <UBadge
          :label="String(allAlerts.length)"
          color="warning"
          variant="solid"
          :ui="{ base: 'font-ev-mono font-bold rounded-full min-w-5.5 justify-center' }"
        />
      </div>

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
