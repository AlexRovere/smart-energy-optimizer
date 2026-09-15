<script setup lang="ts">
const {
  stats,
  totalConsumptionDisplay,
  loadPercent,
  activeAlertCount,
  alertNote,
  alertNoteTone,
  healthDisplay,
  healthRatio,
  healthNote,
  healthColor,
  recentAlerts,
  alerts,
} = useFleetOverview()

const lastUpdate = computed(() => {
  if (!stats.value?.timestamp) return ''
  return new Date(stats.value.timestamp).toLocaleString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
})
</script>

<template>
  <div class="p-7 flex flex-col gap-6">
    <header>
      <h2 class="font-ev text-[28px] font-bold tracking-tight">
        Vue d'ensemble du parc
      </h2>
      <p class="font-ev text-sm text-ev-text-2 mt-1">
        Dernière mise à jour : {{ lastUpdate }}
      </p>
    </header>

    <!-- G4 : bannière données incomplètes ici -->

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--ev-gap-card)]">
      <EvKpiCard
        label="CONSO TOTALE"
        :value="totalConsumptionDisplay"
        unit="kW"
        :progress="loadPercent"
      />
      <EvKpiCard
        label="ALERTES ACTIVES"
        :value="activeAlertCount"
        :note="alertNote"
        :note-tone="alertNoteTone"
      />
      <EvGauge
        label="SANTÉ CAPTEURS"
        :value="healthDisplay"
        unit="%"
        :ratio="healthRatio"
        :note="healthNote"
        :color="healthColor"
      />
    </div>

    <EvCard>
      <template #title>
        <span class="font-ev text-base font-semibold">Alertes récentes</span>
      </template>
      <template #subtitle>
        <span class="font-ev text-xs text-ev-text-3">
          {{ alerts.length }} alertes actives
        </span>
      </template>
      <div class="flex flex-col gap-3">
        <EvAlertCard
          v-for="a in recentAlerts"
          :key="a.alert_id"
          :alert="a"
        />
        <p
          v-if="!recentAlerts.length"
          class="font-ev text-sm text-ev-text-3 py-4 text-center"
        >
          Aucune alerte active
        </p>
      </div>
    </EvCard>
  </div>
</template>
