<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { sites } = useSites()
const { account, logout } = useAccountSession()
const toast = useToast()
const { pending, dernierEntrainement, déclencher } = useTraining()

const initiales = computed(() => {
  const local = account.value?.email.split('@')[0] ?? ''
  const segments = local.split('.')
  if (segments.length > 1) {
    return segments.map(s => s[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '?'
  }
  return local.slice(0, 2).toUpperCase() || '?'
})

const labelRôle = computed(() => roleLabel(account.value?.role))
const { modele, rafraichirModele, disponible: modeleDisponible } = useModeleML()
const { health } = useHealth()

const SERVICE = {
  ok: { badge: 'ok', label: 'Service opérationnel' },
  degraded: { badge: 'degraded', label: 'Historique indisponible' },
  down: { badge: 'critical', label: 'Service indisponible' },
} as const

const service = computed(() => health.value ? SERVICE[health.value.status] : null)
const derniereCollecte = computed(() => health.value?.last_data_at
  ? `dernière collecte ${fmtShortDateTime(health.value.last_data_at)}`
  : 'aucune collecte connue')

watch(dernierEntrainement, (val) => {
  if (val?.statut === 'succès') rafraichirModele()
})

async function lancerEntrainement() {
  try {
    await déclencher()
    toast.add({ title: 'Entraînement déclenché', description: 'La demande a été transmise au service ML.', color: 'success' })
  } catch (err: unknown) {
    const code = (err as { statusCode?: number }).statusCode
    const description = code === 409 ? 'Un entraînement est déjà en cours.' : 'Le service ML est indisponible.'
    toast.add({ title: 'Échec du déclenchement', description, color: 'error' })
  }
}

const pilotageItems = computed<NavigationMenuItem[]>(() => [
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
      label: `${s.site_id} — ${s.site_name}`,
      to: `/sites/${s.site_id}`,
      health: s.health
    }))
  },
  {
    label: 'Prédiction IA',
    icon: 'i-heroicons-cpu-chip',
    to: '/predictions',
    badge: '3',
  }
])

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
        <!-- Modèle actif + entraînement — ADMIN uniquement -->
        <template v-if="!collapsed && account?.role === 'ADMIN'">
          <EvModelCard :modele="modele" :disponible="modeleDisponible" />
          <EvTrainingButton
            :dernier-entrainement="dernierEntrainement"
            :loading="pending"
            @déclencher="lancerEntrainement"
          />
        </template>

        <!-- Status API -->
        <div
          v-if="!collapsed && service"
          class="border border-ev-border rounded-ev-btn p-3.5 flex flex-col gap-2.5"
        >
          <span class="font-ev text-[11px] font-medium tracking-[0.06em] text-ev-text-4">COLLECTE</span>
          <EvHealthBadge :status="service.badge" :label="service.label" />
          <span class="font-ev-mono text-[11px] leading-snug text-ev-text-4">
            {{ derniereCollecte }}
          </span>
        </div>

        <!-- User -->
        <div class="flex items-center gap-2.5 px-2 pb-2">
          <UAvatar
            :text="initiales"
            size="sm"
            :ui="{ root: 'bg-ev-green-bg text-ev-green font-semibold shrink-0' }"
            data-testid="user-avatar"
          />
          <div v-if="!collapsed" class="flex flex-col gap-0.5 min-w-0">
            <span class="font-ev text-[13px] font-semibold leading-none truncate">{{ account?.email }}</span>
            <span class="font-ev text-[11px] leading-none text-ev-text-4">{{ labelRôle }}</span>
          </div>
          <UButton
            v-if="!collapsed"
            icon="i-heroicons-arrow-right-on-rectangle"
            color="neutral"
            variant="ghost"
            size="sm"
            class="ml-auto cursor-pointer"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            @click="logout"
          />
        </div>
      </div>
    </template>
  </UDashboardSidebar>
</template>
