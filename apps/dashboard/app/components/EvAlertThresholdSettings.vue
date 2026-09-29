<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AlertThresholdEntry, AlertThresholdInput } from '~~/shared/alertThresholdSchema'

const { thresholds, save } = useAlertThresholds()
const { sites } = useSitesList()

const TYPE_LABEL = { conso: 'CONSO', pic: 'PIC' } as const

function siteName(siteId: string): string {
  return sites.value.find(s => s.site_id === siteId)?.site_name ?? siteId
}

function displayedThreshold(entry: AlertThresholdEntry): string {
  return entry.type === 'pic'
    ? `${Math.round(entry.threshold * 100)} %`
    : `${entry.threshold} kWh`
}

const rows = computed(() =>
  [...thresholds.value].sort((a, b) =>
    a.site_id === b.site_id ? a.type.localeCompare(b.type) : a.site_id.localeCompare(b.site_id)
  )
)

const editing = ref<AlertThresholdEntry | null>(null)

async function saveThreshold(values: AlertThresholdInput) {
  if (!editing.value) return
  await save(editing.value.site_id, editing.value.type, values)
  editing.value = null
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
          v-for="entry in rows"
          :key="`${entry.site_id}-${entry.type}`"
          data-testid="threshold-row"
          class="border-b last:border-b-0"
          style="border-color: var(--ev-border)"
        >
          <td class="py-4 pr-6 font-ev text-sm font-semibold">{{ siteName(entry.site_id) }}</td>
          <td class="py-4 pr-6 font-ev-mono text-xs text-ev-text-3">{{ TYPE_LABEL[entry.type] }}</td>
          <td class="py-4 pr-6 font-ev-mono text-sm">{{ entry.duration }}</td>
          <td class="py-4 pr-6 font-ev-mono text-sm">{{ displayedThreshold(entry) }}</td>
          <td class="py-4">
            <EvButton data-testid="edit-btn" variant="secondary" @click="editing = entry">Éditer</EvButton>
          </td>
        </tr>
      </tbody>
    </table>

    <EvAlertThresholdModal
      :open="editing !== null"
      :site-name="editing ? siteName(editing.site_id) : ''"
      :type="editing?.type ?? 'conso'"
      :initial="editing ? { duration: editing.duration, threshold: editing.threshold } : { duration: 5, threshold: 200 }"
      @close="editing = null"
      @save="saveThreshold"
    />
  </EvCard>
</template>
