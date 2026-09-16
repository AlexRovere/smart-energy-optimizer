<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { sites } = useSites()

const pilotageItems: NavigationMenuItem[] = [
  {
    label: 'Vue d\'ensemble',
    icon: 'i-heroicons-chart-bar-square',
    to: '/',
  },
  {
    label: 'Sites & capteurs',
    icon: 'i-heroicons-building-office-2',
    to: '/sites',
    children: sites.value.map(s => ({
      label: `${s.site_id}-${s.site_name}`,
      to: `/sites/${s.site_id}`,
      health: s.health
    }))
  },
  {
    label: 'Prédiction IA',
    icon: 'i-heroicons-cpu-chip',
    to: '/predictions',
    badge: '3',
  },
  {
    label: 'Rapports CSRD',
    icon: 'i-heroicons-document-chart-bar',
    to: '/reports',
  },
]

const systemeItems: NavigationMenuItem[] = [
  {
    label: 'Paramétrages',
    icon: 'i-heroicons-cog-6-tooth',
    to: '/settings',
  },
]
</script>

<template>
  <UDashboardSidebar
    collapsible
    class="bg-ev-surface-0 border-r border-ev-border"
  >
    <template #header="{ collapsed }">
      <div class="flex items-center gap-2.5 px-2">
        <EvLogo :wordmark="!collapsed" :tagline="!collapsed" />
      </div>
    </template>

    <template #default="{ collapsed }">
      <UNavigationMenu
        :collapsed="collapsed"
        :items="pilotageItems"
        color="primary"
        orientation="vertical"
        tooltip
      >
        <template v-if="!collapsed" #list-leading>
          <span class="font-ev-mono text-[10px] font-medium tracking-[0.16em] text-ev-text-muted px-2 pt-2">
            PILOTAGE
          </span>
        </template>

        <template #item-trailing="{ item }">
          <span
            v-if="item.health"
            class="size-2 rounded-full shrink-0"
            :class="{
              'bg-ev-green': item.health === 'ok',
              'bg-ev-amber': item.health === 'degraded',
              'bg-ev-red': item.health === 'critical'
            }"
          />
        </template>
      </UNavigationMenu>

      <UNavigationMenu
        :collapsed="collapsed"
        :items="systemeItems"
        color="primary"
        orientation="vertical"
        tooltip
      >
        <template v-if="!collapsed" #list-leading>
          <span class="font-ev-mono text-[10px] font-medium tracking-[0.16em] text-ev-text-muted px-2 pt-4">
            SYSTÈME
          </span>
        </template>
      </UNavigationMenu>
    </template>

    <template #footer="{ collapsed }">
      <div class="flex flex-col gap-3 px-2">
        <!-- Status API -->
        <div
          v-if="!collapsed"
          class="border border-ev-border rounded-ev-btn p-3.5 flex flex-col gap-2.5"
        >
          <span class="font-ev text-[11px] font-medium tracking-[0.06em] text-ev-text-4">COLLECTE</span>
          <EvHealthBadge status="ok" label="API healthy" />
          <span class="font-ev-mono text-[11px] leading-snug text-ev-text-4">
            polling /current · 60 s
          </span>
          <span class="font-ev-mono text-[11px] leading-snug text-ev-text-4">
            dernière collecte · 14/09/2026
          </span>
        </div>

        <!-- User -->
        <div class="flex items-center gap-2.5 px-2 pb-2">
          <UAvatar
            text="MD"
            size="sm"
            :ui="{ root: 'bg-ev-green-bg text-ev-green font-semibold shrink-0' }"
          />
          <div v-if="!collapsed" class="flex flex-col gap-0.5 min-w-0">
            <span class="font-ev text-[13px] font-semibold leading-none truncate">M. Deschamps</span>
            <span class="font-ev text-[11px] leading-none text-ev-text-4">Administrateur</span>
          </div>
        </div>
      </div>
    </template>
  </UDashboardSidebar>
</template>
