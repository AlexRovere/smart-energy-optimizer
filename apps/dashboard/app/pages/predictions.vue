<script setup lang="ts">
import { ref } from 'vue'
import type { SiteId } from '~/types/api'
import { usePredictions } from '~/composables/usePredictions'

const {
  selectedSiteId, siteInfo, prediction,
  historicalPoints, recommendations,
  thresholdKw, peakKw, peakTime, marginKw,
  exceedanceExpected, modelConfidence,
} = usePredictions()

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

function appliedGainTotal() {
  return 0
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
          — horizon {{ prediction.horizon_hours }} h, pas horaire.
        </p>
        <!-- Bannière mode démonstration -->
        <p class="font-ev text-xs font-medium" style="color: var(--ev-amber)">
          Endpoint prédictif non spécifié : valeurs issues d'un modèle local de démonstration.
        </p>
      </div>

      <!-- Sélecteur de sites -->
      <div class="flex flex-wrap gap-1.5 shrink-0 mt-1">
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
    </header>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-ev-card">
      <EvKpiCard
        label="PIC PRÉVU"
        :value="String(Math.round(peakKw))"
        unit="kW"
        :note="`à ${peakTime} · horizon ${prediction.horizon_hours} h`"
      />
      <EvKpiCard
        label="MARGE AU SEUIL"
        :value="String(Math.round(marginKw))"
        unit="kW"
        :note="`seuil configuré ${thresholdKw} kW`"
      />
      <EvKpiCard
        label="DÉPASSEMENT ATTENDU"
        :value="exceedanceExpected ? 'oui' : 'aucun'"
        :note="exceedanceExpected ? 'dépassement prévu sur l\'horizon' : 'sous le seuil sur tout l\'horizon'"
        :note-tone="exceedanceExpected ? 'amber' : 'muted'"
      />
      <EvKpiCard
        label="CONFIANCE DU MODÈLE"
        :value="String(modelConfidence)"
        unit="%"
        note="schéma de réponse à figer (EC06)"
      />
    </div>

    <!-- Graphique -->
    <EvCard tone="light">
      <EvPredictionChart
        :historical-points="historicalPoints"
        :forecast-points="prediction.predictions"
        :threshold="thresholdKw"
        :confidence-level="prediction.confidence_level ?? 0"
      />
    </EvCard>

    <!-- Section basse -->
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6 items-start">

      <!-- Actions correctives -->
      <EvCard>
        <template #title>
          <span class="font-ev text-base font-semibold">Actions correctives proposées</span>
        </template>
        <template #actions>
          <span class="font-ev-mono text-xs text-ev-text-3">
            gain cumulé appliqué · {{ appliedGainTotal() }} kW
          </span>
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
          <label class="font-ev-mono text-xs text-ev-text-3">duration_minutes</label>
          <UInput
            v-model.number="simulationDuration"
            type="number"
            min="1"
            max="60"
            class="w-full bg-ev-surface border border-ev-border rounded-ev-md px-3 py-2 font-ev-mono text-sm text-ev-text focus:outline-none"
            style="border-color: var(--ev-border-hover)"
          />
        </div>

        <EvButton variant="accent" :block="true">
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
