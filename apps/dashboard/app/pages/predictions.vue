<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SiteId } from '~/types/api'
import { usePredictions } from '~/composables/usePredictions'

const {
  selectedSiteId, horizonHeures, siteInfo,
  historicalPoints, recommendations,
  thresholdKw, peakKw, peakTime, marginKw, exceedanceExpected,
  forecastPoints, confidenceLevel, modelVersion, predictedAt, nbPoints,
  available, lancer, lancee, dureeMs, pending,
} = usePredictions()

// Les indicateurs n'ont de sens qu'une fois la prévision revenue.
const prévisionPrête = computed(() => lancee.value && !pending.value && available.value && forecastPoints.value.length > 0)

function kw(valeur: number | null): string {
  return prévisionPrête.value && valeur != null ? String(Math.round(valeur)) : '—'
}

const SITES: { id: SiteId; label: string }[] = [
  { id: 'SITE001', label: 'S001' },
  { id: 'SITE002', label: 'S002' },
  { id: 'SITE003', label: 'S003' },
  { id: 'SITE004', label: 'S004' },
  { id: 'SITE005', label: 'S005' },
  { id: 'SITE006', label: 'S006' },
  { id: 'SITE007', label: 'S007' },
]

const simulationDuration = ref(15)
const toast = useToast()

function injecterPic() {
  toast.add({ title: 'Fonctionnalité non disponible dans cette version', color: 'warning' })
}
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-7 flex flex-col gap-6">

    <!-- Header -->
    <header class="flex items-start justify-between gap-6 flex-wrap">
      <div class="flex flex-col gap-2">
        <h2 class="font-ev text-[28px] font-bold tracking-tight">Prédiction &amp; actions correctives</h2>
        <p class="font-ev text-sm text-ev-text-3">
          {{ selectedSiteId }} · {{ siteInfo?.site_name ?? '—' }}
          · horizon {{ horizonHeures }} h, pas horaire.
        </p>
      </div>

      <div class="flex flex-col items-end gap-3 shrink-0 mt-1">
        <!-- Sélecteur de sites -->
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in SITES"
            :key="s.id"
            class="font-ev-mono text-xs font-bold px-3 py-1.5 rounded-full border transition-colors cursor-pointer"
            :style="selectedSiteId === s.id
              ? 'background: var(--ev-green); border-color: var(--ev-green); color: #fff'
              : 'background: transparent; border-color: var(--ev-border); color: var(--ev-text-3)'"
            @click="selectedSiteId = s.id"
          >{{ s.label }}</button>
        </div>

        <!-- Horizon et déclenchement -->
        <div class="flex items-start gap-3">
          <div class="flex gap-1">
            <UButton
              v-for="h in [24, 48]"
              :key="h"
              size="xs"
              :variant="horizonHeures === h ? 'solid' : 'ghost'"
              color="primary"
              @click="horizonHeures = h"
            >{{ h }}h</UButton>
          </div>
          <EvPredictionTrigger
            :site-id="selectedSiteId"
            :lancee="lancee"
            :pending="pending"
            :available="available"
            :predicted-at="predictedAt"
            :nb-points="nbPoints"
            :model-version="modelVersion"
            :duree-ms="dureeMs"
            @lancer="lancer"
          />
        </div>
      </div>
    </header>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-ev-card">
      <EvKpiCard
        label="PIC PRÉVU"
        :value="kw(peakKw)"
        unit="kW"
        :note="prévisionPrête ? `à ${peakTime} · horizon ${horizonHeures} h` : 'en attente de prédiction'"
      />
      <EvKpiCard
        label="MARGE AU SEUIL"
        :value="kw(marginKw)"
        unit="kW"
        :note="`seuil configuré ${thresholdKw} kW`"
      />
      <EvKpiCard
        label="DÉPASSEMENT ATTENDU"
        :value="prévisionPrête ? (exceedanceExpected ? 'oui' : 'aucun') : '—'"
        :note="!prévisionPrête ? 'en attente de prédiction' : exceedanceExpected ? 'dépassement prévu sur l\'horizon' : 'sous le seuil sur tout l\'horizon'"
        :note-tone="prévisionPrête && exceedanceExpected ? 'amber' : 'muted'"
      />
      <EvKpiCard
        label="VERSION DU MODÈLE"
        :value="prévisionPrête && modelVersion ? `v${modelVersion}` : '—'"
        note="modèle champion du registre MLflow"
      />
    </div>

    <!-- Graphique -->
    <EvCard tone="light">
      <div v-if="!lancee" class="py-16 text-center font-ev text-sm text-ev-text-3">
        Choisissez un site et un horizon, puis cliquez sur « Lancer la prédiction ».
      </div>

      <div v-else-if="pending" class="py-16 text-center font-ev text-sm text-ev-text-3">
        Calcul de la prévision par le modèle…
      </div>

      <div
        v-else-if="!available"
        class="flex items-center gap-2.5 px-4 py-3 rounded-ev-md border text-sm font-ev"
        style="border-color: var(--ev-amber-bd); background: var(--ev-amber-bg); color: var(--ev-amber)"
      >
        Service de prédiction indisponible : la prévision n'est pas affichée.
      </div>

      <EvPredictionChart
        v-else-if="historicalPoints.length && forecastPoints.length"
        :historical-points="historicalPoints"
        :forecast-points="forecastPoints"
        :threshold="thresholdKw"
        :confidence-level="confidenceLevel"
      />

      <div v-else class="py-16 text-center font-ev text-sm text-ev-text-3">
        Aucune donnée de prévision disponible
      </div>
    </EvCard>

    <!-- Section basse -->
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6 items-start">

      <!-- Actions correctives -->
      <EvCard>
        <template #title>
          <span class="font-ev text-base font-semibold">Actions correctives proposées</span>
        </template>
        <div>
          <EvCorrectionAction
            v-for="rec in recommendations"
            :key="rec.recommendation_id"
            :recommendation="rec"
          />
        </div>
      </EvCard>

      <!-- Simulation de pic -->
      <div
        class="rounded-ev-lg p-5.5 flex flex-col gap-4 border"
        style="background: var(--ev-surface-2); border-color: var(--ev-amber-bd)"
      >
        <div class="flex flex-col gap-1">
          <span class="font-ev text-sm font-bold" style="color: var(--ev-amber)">Simulation de pic</span>
          <span class="font-ev-mono text-[10px] text-ev-text-3">
            POST /simulate/spike/{{ selectedSiteId }}?duration_minutes
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="simulation-duration" class="font-ev-mono text-xs text-ev-text-3">duration_minutes</label>
          <UInput
            id="simulation-duration"
            v-model.number="simulationDuration"
            type="number"
            min="1"
            max="60"
            class="w-full bg-ev-surface border border-ev-border rounded-ev-md px-3 py-2 font-ev-mono text-sm text-ev-text focus:outline-none"
            style="border-color: var(--ev-border-hover)"
          />
        </div>

        <EvButton data-testid="injecter-pic-btn" variant="accent" :block="true" @click="injecterPic()">
          Injecter un pic sur {{ selectedSiteId }}
        </EvButton>

        <p class="font-ev text-[11px] leading-relaxed text-ev-text-3">
          Le pic est appliqué aux 4 derniers points de la série et se propage au dashboard, aux jauges et à la prévision.
          Compression de temps : 1 min simulée = 1 s réelle.
        </p>
      </div>

    </div>
  </div>
</template>
