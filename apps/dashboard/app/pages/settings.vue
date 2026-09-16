<script setup lang="ts">
import type { UserRole } from '~/types/api'
import { useSettings } from '~/composables/useSettings'

const {
  activeRole, roleCapabilities,
  siteThresholds, hasUnsavedChanges,
  updateThreshold, resetThresholds, saveThresholds, capacityPercent,
  notifications, updateNotification,
  session,
} = useSettings()

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
        Seuils par site, rôle actif et préférences de notification.
        <span class="font-medium" style="color: var(--ev-amber)">
          L'écriture des seuils n'a pas d'endpoint&nbsp;: persistance locale en attendant le contrat API.
        </span>
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

    <!-- Seuils de déclenchement par site -->
    <EvCard>
      <template #title>
        <span class="font-ev text-base font-semibold">Seuils de déclenchement par site</span>
      </template>
      <template #actions>
        <EvButton variant="secondary" @click="resetThresholds">Réinitialiser</EvButton>
        <EvButton variant="primary" :disabled="!hasUnsavedChanges" @click="saveThresholds">Enregistrer</EvButton>
      </template>

      <table class="w-full">
        <thead>
          <tr class="border-b" style="border-color: var(--ev-border)">
            <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3 pr-6">SITE</th>
            <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3 pr-6">CAPACITÉ</th>
            <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3 pr-6">SEUIL (kW)</th>
            <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3 pr-6">% DE CAPACITÉ</th>
            <th class="font-ev-mono text-[11px] font-semibold text-ev-text-3 text-left pb-3">ÉTAT</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in siteThresholds"
            :key="entry.site_id"
            class="border-b last:border-b-0"
            style="border-color: var(--ev-border)"
          >
            <!-- Site -->
            <td class="py-4 pr-6">
              <div class="font-ev text-sm font-semibold">{{ entry.site_name }}</div>
              <div class="font-ev-mono text-[11px] text-ev-text-3 mt-0.5">{{ entry.site_id }}</div>
            </td>

            <!-- Capacité -->
            <td class="py-4 pr-6">
              <span class="font-ev-mono text-sm text-ev-text-2">{{ entry.capacity_kw.toLocaleString('fr-FR') }}</span>
            </td>

            <!-- Seuil éditable -->
            <td class="py-4 pr-6">
              <UInput
                :model-value="entry.threshold_kw"
                type="number"
                min="1"
                :max="entry.capacity_kw"
                class="w-28"
                :ui="{ base: 'font-ev-mono text-sm' }"
                @update:model-value="updateThreshold(entry.site_id, Number($event))"
              />
            </td>

            <!-- % de capacité -->
            <td class="py-4 pr-6">
              <div class="flex items-center gap-3">
                <div class="w-24 h-1.5 rounded-full overflow-hidden" style="background: var(--ev-surface)">
                  <div
                    class="h-full rounded-full transition-all"
                    style="background: var(--ev-green)"
                    :style="{ width: capacityPercent(entry) + '%' }"
                  />
                </div>
                <span class="font-ev-mono text-sm text-ev-text-2">{{ capacityPercent(entry) }} %</span>
              </div>
            </td>

            <!-- État -->
            <td class="py-4">
              <span
                class="font-ev text-sm"
                :style="entry.state === 'modifié' ? 'color: var(--ev-amber)' : 'color: var(--ev-text-3)'"
              >{{ entry.state }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </EvCard>

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
              @click="updateNotification(notif.key, !notifications[notif.key])"
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
