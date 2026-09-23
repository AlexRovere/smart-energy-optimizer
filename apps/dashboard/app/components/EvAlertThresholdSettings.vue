<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AlertThresholdEntry, AlertThresholdInput } from '~~/shared/alertThresholdSchema'

const { thresholds, save } = useAlertThresholds()
const { sites } = useSitesList()

const TYPE_LABEL = { conso: 'CONSO', pic: 'PIC' } as const

function siteName(siteId: string): string {
  return sites.value.find(s => s.site_id === siteId)?.site_name ?? siteId
}

function seuilAffiché(entrée: AlertThresholdEntry): string {
  return entrée.type === 'pic'
    ? `${Math.round(entrée.threshold * 100)} %`
    : `${entrée.threshold} kWh`
}

const rows = computed(() =>
  [...thresholds.value].sort((a, b) =>
    a.site_id === b.site_id ? a.type.localeCompare(b.type) : a.site_id.localeCompare(b.site_id)
  )
)

const édition = ref<AlertThresholdEntry | null>(null)

async function enregistrer(valeurs: AlertThresholdInput) {
  if (!édition.value) return
  await save(édition.value.site_id, édition.value.type, valeurs)
  édition.value = null
}
</script>

<template>
  <EvCard>
    <template #title>
      <span class="font-ev text-base font-semibold">Règles d'alerte par site</span>
    </template>

    <table class="w-full">
      <thead>
        <tr class="border-b" style="border-color: var(--ev-border)">
          <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3 pr-6">SITE</th>
          <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3 pr-6">TYPE</th>
          <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3 pr-6">POINTS (H)</th>
          <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3 pr-6">SEUIL</th>
          <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="entrée in rows"
          :key="`${entrée.site_id}-${entrée.type}`"
          data-testid="ligne-seuil"
          class="border-b last:border-b-0"
          style="border-color: var(--ev-border)"
        >
          <td class="py-4 pr-6 font-ev text-sm font-semibold">{{ siteName(entrée.site_id) }}</td>
          <td class="py-4 pr-6 font-ev-mono text-xs text-ev-text-3">{{ TYPE_LABEL[entrée.type] }}</td>
          <td class="py-4 pr-6 font-ev-mono text-sm">{{ entrée.duration }}</td>
          <td class="py-4 pr-6 font-ev-mono text-sm">{{ seuilAffiché(entrée) }}</td>
          <td class="py-4">
            <EvButton data-testid="editer-btn" variant="secondary" @click="édition = entrée">Éditer</EvButton>
          </td>
        </tr>
      </tbody>
    </table>

    <EvAlertThresholdModal
      :open="édition !== null"
      :site-name="édition ? siteName(édition.site_id) : ''"
      :type="édition?.type ?? 'conso'"
      :initial="édition ? { duration: édition.duration, threshold: édition.threshold } : { duration: 5, threshold: 200 }"
      @close="édition = null"
      @save="enregistrer"
    />
  </EvCard>
</template>
