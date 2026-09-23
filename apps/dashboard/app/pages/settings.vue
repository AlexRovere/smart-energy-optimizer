<script setup lang="ts">
import type { UserRole } from '~/types/api'
import { useSettings } from '~/composables/useSettings'

const {
  activeRole, roleCapabilities,
  notifications, updateNotification,
  session,
} = useSettings()

const toast = useToast()

function basculerNotification(key: keyof typeof notifications.value) {
  updateNotification(key, !notifications.value[key])
  toast.add({ title: 'Fonctionnalité non disponible dans cette version', color: 'warning' })
}

const ROLES: { id: UserRole; label: string }[] = [
  { id: 'admin',    label: 'Admin' },
  { id: 'operator', label: 'Opérateur' },
  { id: 'viewer',   label: 'Lecteur' },
]

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:    'Accès complet : lecture, écriture des seuils, simulation de pic et export du relevé.',
  operator: 'Lecture du parc et écriture des seuils.',
  viewer:   'Lecture seule du parc et des alertes.',
}

const NOTIFICATIONS: { key: keyof typeof notifications.value; label: string; description: string }[] = [
  { key: 'critical_alerts', label: 'Alertes critical et high',       description: 'e-mail immédiat + notification navigateur' },
  { key: 'daily_summary',   label: 'Synthèse quotidienne du parc',   description: 'chaque jour à 07:00' },
  { key: 'sensor_fault',    label: 'Capteurs en défaut',             description: 'regroupé, une fois par heure' },
]
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-7 flex flex-col gap-6">

    <!-- Header -->
    <header class="flex flex-col gap-1.5">
      <h2 class="font-ev text-[28px] font-bold tracking-tight">Paramétrages</h2>
      <p class="font-ev text-sm text-ev-text-3">
        Règles d'alerte par site, rôle actif et préférences de notification.
      </p>
    </header>

    <!-- Rôle actif (RBAC) -->
    <EvCard>
      <template #title>
        <span class="font-ev text-base font-semibold">Rôle actif (RBAC)</span>
        <span class="font-ev text-xs text-ev-text-3 mt-0.5">{{ ROLE_DESCRIPTIONS[activeRole] }}</span>
      </template>
      <template #actions>
        <div class="flex gap-2">
          <button
            v-for="r in ROLES"
            :key="r.id"
            class="font-ev text-sm font-semibold px-4 py-1.5 rounded-ev-btn border transition-colors cursor-pointer"
            :style="activeRole === r.id
              ? 'background: var(--ev-green); border-color: var(--ev-green); color: #000'
              : 'background: transparent; border-color: var(--ev-border); color: var(--ev-text-3)'"
            @click="activeRole = r.id"
          >{{ r.label }}</button>
        </div>
      </template>

      <!-- Capacités -->
      <div class="flex flex-wrap gap-3 pt-1">
        <div
          v-for="cap in roleCapabilities"
          :key="cap"
          class="flex items-center gap-2 rounded-ev-md px-4 py-2 border"
          style="background: color-mix(in srgb, var(--ev-green) 8%, transparent); border-color: color-mix(in srgb, var(--ev-green) 25%, transparent)"
        >
          <span style="color: var(--ev-green)">✓</span>
          <span class="font-ev text-sm font-semibold">{{ cap }}</span>
        </div>
      </div>
    </EvCard>

    <!-- Règles d'alerte par site -->
    <EvAlertThresholdSettings />

    <!-- Ligne du bas : Notifications + Session -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- Notifications -->
      <EvCard>
        <template #title>
          <span class="font-ev text-base font-semibold">Notifications</span>
        </template>

        <div class="flex flex-col divide-y" style="--un-divide-opacity: 1; border-color: var(--ev-border)">
          <div
            v-for="notif in NOTIFICATIONS"
            :key="notif.key"
            class="flex items-center justify-between py-4 first:pt-2 last:pb-0"
            style="border-color: var(--ev-border)"
          >
            <div class="flex flex-col gap-0.5">
              <span class="font-ev text-sm font-semibold">{{ notif.label }}</span>
              <span class="font-ev text-xs text-ev-text-3">{{ notif.description }}</span>
            </div>
            <!-- Toggle -->
            <button
              role="switch"
              :aria-checked="notifications[notif.key]"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
              :style="notifications[notif.key]
                ? 'background: var(--ev-green)'
                : 'background: var(--ev-border)'"
              @click="basculerNotification(notif.key)"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                :style="notifications[notif.key] ? 'transform: translateX(20px)' : 'transform: translateX(0)'"
              />
            </button>
          </div>
        </div>
      </EvCard>

      <!-- Session -->
      <EvCard>
        <template #title>
          <span class="font-ev text-base font-semibold">Session</span>
        </template>

        <div class="flex flex-col gap-3 font-ev-mono text-sm">
          <div class="flex gap-2">
            <span class="text-ev-text-3 w-24 shrink-0">utilisateur</span>
            <span class="font-semibold">{{ session.user_name }}</span>
          </div>
          <div class="flex gap-2">
            <span class="text-ev-text-3 w-24 shrink-0">rôle</span>
            <span class="font-semibold" style="color: var(--ev-green)">{{ session.role }}</span>
          </div>
          <div class="flex gap-2">
            <span class="text-ev-text-3 w-24 shrink-0">polling</span>
            <span>polling /current · {{ session.polling_interval_s }} s</span>
          </div>
          <div class="flex gap-2">
            <span class="text-ev-text-3 w-24 shrink-0">health</span>
            <span style="color: var(--ev-green)">{{ session.health_label }}</span>
          </div>
        </div>

        <div class="pt-3">
          <EvButton variant="danger">Déconnexion</EvButton>
        </div>
      </EvCard>

    </div>
  </div>
</template>
