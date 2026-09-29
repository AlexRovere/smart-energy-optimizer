<script setup lang="ts">
import { useSiteCurrentReading } from '~/composables/useSiteCurrentReading';
import type { SiteId } from '~/types/api'
import { useSiteHistory } from '~/composables/useSiteHistory'
import { useSiteRecommendations } from '~/composables/useSiteRecommendations'
import { useSitePrediction } from '~/composables/useSitePrediction'

const route = useRoute()
const router = useRouter()

const id = computed(() => route.params.id as SiteId)

const { getSite, getSiteSensors, getSiteAlerts, getSiteHealth, getSiteInfo } = useSites()

const { data: reading, pending: readingPending, error: readingError } = useSiteCurrentReading(id)

const { recommendations, unavailable, pending } = useSiteRecommendations(id)
const SOURCE_LABELS = { history: 'historique indisponible', forecast: 'prévision indisponible' } as const
const unavailableLabel = computed(() => unavailable.value.map(source => SOURCE_LABELS[source]).join(', '))
const popupDismissed = ref(false)
watch(id, () => { popupDismissed.value = false })
const popupOpen = computed(() => recommendations.value.length > 0 && !popupDismissed.value)

// Mesure courante, ou dernière valeur connue de l'historique si le capteur est muet.
const consumption = computed(() => displayedConsumption(reading.value, readings.value))

const loadPercent = computed(() => {
  const kw = consumption.value?.kw
  const cap = site.value?.capacity_kw
  if (kw == null || !cap) return
  return (kw / cap) * 100
})

const consumptionNote = computed(() => {
  if (consumption.value?.reportedAt) return `valeur reportée de ${fmtTime(consumption.value.reportedAt)}`
  return loadPercent.value != null ? fmtNum(loadPercent.value) + ' % de la capacité' : 'Données indisponibles'
})

// Mocks
const site = computed(() => getSite(id.value))
const info = computed(() => getSiteInfo(id.value))
const sensors = computed(() => getSiteSensors(id.value))
const alerts = computed(() => getSiteAlerts(id.value))
const health = computed(() => getSiteHealth(id.value))

const chartWindow = ref<'24h' | '7j'>('24h')
const { readings } = useSiteHistory(id, chartWindow)
const horizonHours = ref(24)
const {
  forecastPoints, modelVersion, confidenceLevel, predictedAt, nbPoints,
  available: predictionAvailable, failureMessage: predictionFailure, launch: launchPrediction, launched: predictionLaunched,
  durationMs: predictionDurationMs, pending: predictionPending
} = useSitePrediction(id, horizonHours)

// ── Formatters ──────────────────────────────────────────────────────

function fmtNum(v: number | null, decimals = 1): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtConsumption(kw: number | null): string {
  if (kw == null) return '—'
  return kw.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function chargeColor(pct: number | null): string {
  if (pct == null) return 'rgba(255,255,255,0.15)'
  if (pct >= 80) return 'var(--ev-red)'
  if (pct >= 50) return 'var(--ev-amber)'
  return 'var(--ev-green)'
}

function powerFactorColor(pf: number | null): string {
  if (pf == null) return 'rgba(255,255,255,0.15)'
  if (pf < 0.85) return 'var(--ev-red)'
  if (pf < 0.92) return 'var(--ev-amber)'
  return 'var(--ev-green)'
}

function tempColor(c: number | null): string {
  if (c == null) return 'rgba(255,255,255,0.15)'
  if (c > 35 || c < 15) return 'var(--ev-red)'
  if (c > 30 || c < 18) return 'var(--ev-amber)'
  return 'var(--ev-green)'
}

const toast = useToast()

function configureThresholds() {
  toast.add({ title: 'Fonctionnalité non disponible dans cette version', color: 'warning' })
}

function voltageColor(v: number | null): string {
  if (v == null) return 'rgba(255,255,255,0.15)'
  const dev = Math.abs(v - 400) / 400
  if (dev > 0.10) return 'var(--ev-red)'
  if (dev > 0.05) return 'var(--ev-amber)'
  return 'var(--ev-green)'
}

function sensorStatusColor(status: string): string {
  if (status === 'ok') return 'var(--ev-green)'
  if (status === 'degraded') return 'var(--ev-amber)'
  return 'var(--ev-red)'
}

</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-7 flex flex-col gap-6">

    <!-- Breadcrumb -->
    <nav class="flex items-center gap-1.5 font-ev text-sm text-ev-text-3">
      <button class="hover:text-ev-text transition-colors cursor-pointer" @click="router.push('/')">Parc</button>
      <span>/</span>
      <button class="hover:text-ev-text transition-colors cursor-pointer" @click="router.push('/sites')">Sites</button>
      <span>/</span>
      <span class="text-ev-text font-medium">{{ site?.site_id ?? id }}</span>
    </nav>

    <!-- Site introuvable -->
    <div
      v-if="!site"
      class="flex items-center gap-2.5 px-4 py-3 rounded-ev-md border text-sm font-ev"
      style="border-color: var(--ev-red-bd); background: var(--ev-red-bg); color: var(--ev-red)"
    >
      Site {{ id }} introuvable.
    </div>

    <!-- Source indisponible -->
    <div
      v-if="readingError"
      class="flex items-center gap-2.5 px-4 py-3 rounded-ev-md border text-sm font-ev"
      style="border-color: var(--ev-amber-bd); background: var(--ev-amber-bg); color: var(--ev-amber)"
    >
      Source de données indisponible — les mesures affichées peuvent être obsolètes.
    </div>

    <template v-if="site">

      <!-- Header -->
      <header class="flex items-start justify-between gap-6">
        <div class="flex flex-col gap-2">
          <!-- Titre + badges -->
          <div class="flex items-center gap-3 flex-wrap">
            <h2 class="font-ev text-[28px] font-bold tracking-tight">{{ site.site_name }}</h2>
            <EvHealthBadge :status="health" />
            <EvQualityBadge :quality="site.data_quality" />
          </div>
          <!-- Métadonnées -->
          <div class="flex items-center gap-4 flex-wrap font-ev-mono text-[12px] text-ev-text-3">
            <span>
              <span class="text-ev-text-4">Type</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span class="text-ev-text font-semibold">{{ siteTypeLabel(site.site_type) }}</span>
            </span>
            <span v-if="info?.location">
              <span class="text-ev-text-4">Localisation</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span class="text-ev-text font-semibold">{{ info.location }}</span>
            </span>
            <span>
              <span class="text-ev-text-4">Capacité</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span class="text-ev-text font-semibold">{{ site.capacity_kw.toLocaleString('fr-FR') }} kW</span>
            </span>
            <span v-if="info?.threshold_kw">
              <span class="text-ev-text-4">Seuil d'alerte</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span style="color: var(--ev-amber)" class="font-semibold">{{ info.threshold_kw.toLocaleString('fr-FR') }} kW</span>
            </span>
            <span>
              <span class="text-ev-text-4">Dernière donnée</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span class="text-ev-text font-semibold">{{ fmtShortDateTime(info?.last_data_at, 'aucune') }}</span>
            </span>
            <span v-if="info?.status">
              <span class="text-ev-text-4">Statut</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span style="color: var(--ev-green)" class="font-semibold">{{ siteStatusLabel(info.status) }}</span>
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 shrink-0 mt-1">
          <EvButton data-testid="configure-thresholds-btn" variant="secondary" @click="configureThresholds()">Configurer les seuils</EvButton>
        </div>
      </header>

      <!-- 4 KPI gauges -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-(--ev-gap-card) transition-opacity" :class="{ 'opacity-40': readingPending }">
        <EvGauge
          label="CONSOMMATION"
          :value="fmtConsumption(consumption?.kw ?? null)"
          unit="kW"
          :note="consumptionNote"
          :ratio="loadPercent != null ? loadPercent / 100 : null"
          :color="chargeColor(loadPercent ?? null)"
        />
        <EvGauge
          label="TENSION"
          :value="fmtNum(reading?.voltage_v ?? null)"
          unit="V"
          note="nominal 400 V ± 10 %"
          :ratio="reading?.voltage_v != null ? Math.min(reading.voltage_v / 440, 1) : null"
          :color="voltageColor(reading?.voltage_v ?? null)"
        />
        <EvGauge
          label="FACTEUR DE PUISSANCE"
          :value="fmtNum(reading?.power_factor ?? null, 3)"
          unit=""
          :note="(reading?.power_factor ?? 0) < 0.92 ? 'sous le plancher contractuel' : 'dans la norme'"
          :ratio="reading?.power_factor ?? null"
          :color="powerFactorColor(reading?.power_factor ?? null)"
        />
        <EvGauge
          label="TEMPÉRATURE"
          :value="fmtNum(reading?.temperature_celsius ?? null)"
          unit="°C"
          note="plage de service 15–35 °C"
          :ratio="reading?.temperature_celsius != null ? reading.temperature_celsius / 50 : null"
          :color="tempColor(reading?.temperature_celsius ?? null)"
        />
      </div>

      <!-- Historique de consommation -->
      <EvConsumptionChart
        v-model:window="chartWindow"
        :readings="readings"
        :capacity-kw="site?.capacity_kw ?? null"
        :threshold-kw="info?.threshold_kw ?? null"
      />

      <!-- Prévision de consommation -->
      <EvCard>
        <template #title>
          <div class="flex items-center justify-between w-full">
            <div>
              <span class="font-ev text-base font-semibold">Prévision de consommation</span>
              <div v-if="modelVersion" class="font-ev-mono text-[11px] text-ev-text-3 mt-0.5">
                Modèle version {{ modelVersion }}
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="flex gap-1">
                <UButton
                  v-for="h in [24, 48]"
                  :key="h"
                  size="xs"
                  :variant="horizonHours === h ? 'solid' : 'ghost'"
                  color="primary"
                  @click="horizonHours = h"
                >{{ h }}h</UButton>
              </div>
              <EvPredictionTrigger
                :site-id="id"
                :launched="predictionLaunched"
                :pending="predictionPending"
                :available="predictionAvailable"
                :predicted-at="predictedAt"
                :nb-points="nbPoints"
                :model-version="modelVersion"
                :duration-ms="predictionDurationMs"
                @launch="launchPrediction"
              />
            </div>
          </div>
        </template>

        <div v-if="!predictionLaunched" class="py-10 text-center font-ev text-sm text-ev-text-3">
          Choisissez un horizon puis cliquez sur « Lancer la prédiction ».
        </div>

        <div v-else-if="predictionPending" class="py-10 text-center font-ev text-sm text-ev-text-3">
          Calcul de la prévision par le modèle…
        </div>

        <div
          v-else-if="!predictionAvailable"
          class="flex items-center gap-2.5 px-4 py-3 rounded-ev-md border text-sm font-ev"
          style="border-color: var(--ev-amber-bd); background: var(--ev-amber-bg); color: var(--ev-amber)"
        >
          {{ predictionFailure ?? 'Service de prédiction indisponible' }} : la prévision n'est pas affichée.
        </div>

        <EvPredictionChart
          v-else-if="readings.length && forecastPoints.length"
          :historical-points="readings"
          :forecast-points="forecastPoints"
          :threshold="info?.threshold_kw ?? 0"
          :confidence-level="confidenceLevel"
        />

        <div v-else class="py-10 text-center font-ev text-sm text-ev-text-3">
          Aucune donnée de prévision disponible
        </div>
      </EvCard>

      <!-- Bas de page : 2 colonnes -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-(--ev-gap-card)">

        <!-- Santé des capteurs -->
        <EvCard>
          <template #title>
            <span class="font-ev text-base font-semibold">Santé des capteurs</span>
          </template>

          <div class="flex flex-col divide-y" style="--tw-divide-opacity: 1; border-color: var(--ev-border)">
            <div
              v-for="sensor in sensors"
              :key="sensor.family"
              class="flex items-center justify-between py-3.5"
              style="border-color: var(--ev-border)"
            >
              <span class="font-ev text-sm text-ev-text">{{ sensorFamilyLabel(sensor.family) }}</span>
              <span class="font-ev-mono text-xs text-ev-text-3">
                {{ sensor.failing_until ? `jusqu'à ${fmtTime(sensor.failing_until)}` : '' }}
              </span>
              <span
                class="font-ev-mono text-xs font-semibold px-2.5 py-1 rounded-ev-pill flex items-center gap-1.5"
                :style="{ background: `${sensorStatusColor(sensor.status)}22`, color: sensorStatusColor(sensor.status) }"
              >
                <span class="size-1.5 rounded-full" :style="{ background: sensorStatusColor(sensor.status) }" />
                {{ sensorStateLabel(sensor.status) }}
              </span>
            </div>
          </div>
        </EvCard>

        <!-- Métriques secondaires -->
        <EvCard>
          <template #title>
            <span class="font-ev text-base font-semibold">Métriques secondaires</span>
          </template>

          <div class="flex flex-col gap-0">
            <!-- Courant -->
            <div
              v-if="reading?.current_a != null"
              class="flex items-center justify-between py-3.5 border-b"
              style="border-color: var(--ev-border)"
            >
              <div>
                <div class="font-ev text-sm text-ev-text">Courant</div>
                <div class="font-ev text-[11px] text-ev-text-3 mt-0.5">courant triphasé calculé</div>
              </div>
              <div class="text-right">
                <span class="font-ev-mono text-xl font-bold text-ev-text">{{ fmtNum(reading.current_a) }}</span>
                <span class="font-ev-mono text-xs text-ev-text-3 ml-1">A</span>
              </div>
            </div>

            <!-- Humidité -->
            <div
              v-if="reading?.humidity_percent != null"
              class="flex items-center justify-between py-3.5 border-b"
              style="border-color: var(--ev-border)"
            >
              <div>
                <div class="font-ev text-sm text-ev-text">Humidité</div>
                <div class="font-ev text-[11px] text-ev-text-3 mt-0.5">hygrométrie ambiante</div>
              </div>
              <div class="text-right">
                <span class="font-ev-mono text-xl font-bold text-ev-text">{{ fmtNum(reading.humidity_percent) }}</span>
                <span class="font-ev-mono text-xs text-ev-text-3 ml-1">%</span>
              </div>
            </div>

            <!-- Alertes actives -->
            <div class="flex items-center justify-between py-3.5">
              <div>
                <div class="font-ev text-sm text-ev-text">Alertes actives</div>
                <div class="font-ev text-[11px] text-ev-text-3 mt-0.5">alertes en cours sur ce site</div>
              </div>
              <div class="text-right">
                <span
                  class="font-ev-mono text-xl font-bold"
                  :style="{ color: alerts.length > 0 ? 'var(--ev-amber)' : 'var(--ev-green)' }"
                >{{ alerts.length }}</span>
              </div>
            </div>
          </div>
        </EvCard>

      </div>

      <!-- Alertes actives du site -->
      <EvCard v-if="alerts.length">
        <template #title>
          <span class="font-ev text-base font-semibold">Alertes actives ({{ alerts.length }})</span>
        </template>
        <div class="flex flex-col gap-3">
          <EvAlertCard v-for="a in alerts" :key="a.alert_id" :alert="a" />
        </div>
      </EvCard>

      <!-- Recommandations -->
      <EvCard>
        <template #title>
          <span class="font-ev text-base font-semibold">Recommandations</span>
        </template>

        <div v-if="pending" class="py-6 text-center font-ev text-sm text-ev-text-3">
          Chargement des recommandations…
        </div>

        <output
          v-else-if="unavailable.length"
          class="block mb-2 px-4 py-3 rounded-ev-md border text-sm font-ev"
          style="border-color: var(--ev-amber-bd); background: var(--ev-amber-bg); color: var(--ev-amber)"
        >
          Recommandations partielles : {{ unavailableLabel }}
        </output>

        <div v-if="!pending && recommendations.length === 0 && !unavailable.length" class="py-6 flex flex-col items-center gap-2 text-center">
          <span class="font-ev text-sm font-semibold text-ev-text-3">Aucune recommandation active</span>
          <span class="font-ev text-xs text-ev-text-4">Aucune anomalie de consommation ni pic prévu sur ce site.</span>
        </div>

        <div v-if="!pending && recommendations.length" class="flex flex-col divide-y" style="border-color: var(--ev-border)">
          <div
            v-for="rec in recommendations"
            :key="rec.recommendation_id"
            class="flex items-start gap-4 py-4"
          >
            <div class="pt-0.5 shrink-0">
              <EvSeverityTag :severity="rec.priority" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-ev text-sm font-semibold text-ev-text">{{ rec.title }}</p>
              <p class="font-ev text-xs text-ev-text-3 mt-0.5">{{ rec.description }}</p>
              <p class="font-ev-mono text-[11px] text-ev-text-4 mt-1.5">
                {{ rec.trigger.value_kw }} kW / seuil {{ rec.trigger.threshold_kw }} kW
                · {{ rec.source === 'forecast' ? `prévu le ${fmtShortDateTime(rec.trigger.timestamp)}` : 'seuil dépassé' }}
              </p>
            </div>
          </div>
        </div>
      </EvCard>

    </template>

    <EvAlertPopup
      :open="popupOpen"
      :site-name="site?.site_name ?? String(id)"
      :recommendations="recommendations"
      @close="popupDismissed = true"
    />
  </div>
</template>
