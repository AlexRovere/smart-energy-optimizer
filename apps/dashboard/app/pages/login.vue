<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { FetchError } from 'ofetch'
import { loginSchema, type LoginInput } from '~~/shared/authSchema';

definePageMeta({
  layout: 'blank',
})

const { refresh } = useAccountSession()

const state = reactive<LoginInput>({
  email: '',
  password: '',
})

const loading = ref(false)
const errorMessage = ref('')

async function onSubmit(event: FormSubmitEvent<LoginInput>) {
  errorMessage.value = ''
  loading.value = true

  try {
    // La réponse ne porte aucun jeton : tout ce qui account arrive dans le
    // cookie, que ce code ne peut pas lire et n'a pas à lire.
    await $fetch('/api/auth/login', { method: 'POST', body: event.data })
    await refresh()
    await navigateTo('/')
  }
  catch (err) {
    const failure = err as FetchError
    const delay = Number(failure.response?.headers.get('retry-after'))
    errorMessage.value = loginErrorMessage(
      failure.statusCode ?? 503,
      Number.isFinite(delay) && delay > 0 ? delay : undefined
    )
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh flex">
    <!-- Panneau gauche — Hero -->
    <div class="hidden lg:flex flex-col justify-between flex-1 p-10 border-r border-ev-border">
      <EvLogo :size="60" />

      <div class="flex flex-col gap-6 max-w-lg">
        <p class="font-ev-mono text-[11px] font-medium tracking-[0.16em] text-ev-green uppercase">
          Smart Energy Optimizer
        </p>
        <h1 class="font-ev text-[36px] font-bold leading-[1.15] tracking-tight">
          Pilotez la charge de votre parc industriel, heure par heure.
        </h1>
        <p class="font-ev text-[15px] leading-relaxed text-ev-text-2">
          Monitoring temps réel, supervision des capteurs IoT et anticipation des pics par modèle prédictif. Conforme aux exigences de reporting CSRD.
        </p>
      </div>

      <div class="flex flex-col gap-5">
        <!-- Mini chart décoratif -->
        <svg viewBox="0 0 640 80" class="w-full max-w-lg opacity-40" aria-hidden="true">
          <polyline
            points="0,60 80,50 160,55 240,35 320,40 400,25 480,30 560,20 640,15"
            fill="none" stroke="var(--ev-green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
          />
          <line x1="0" y1="70" x2="640" y2="70" stroke="var(--ev-border-strong)" stroke-width="1" />
        </svg>

        <!-- KPI -->
        <!-- TODO: brancher sur les vraies KPI -->
        <div class="flex gap-12">
          <div>
            <span class="font-ev text-[28px] font-bold text-ev-green leading-none">7</span>
            <p class="font-ev text-[12px] text-ev-text-3 mt-1">sites supervisés</p>
          </div>
          <div>
            <span class="font-ev text-[28px] font-bold text-ev-green leading-none">4 130</span>
            <p class="font-ev text-[12px] text-ev-text-3 mt-1">kW de capacité</p>
          </div>
          <div>
            <span class="font-ev text-[28px] font-bold text-ev-green leading-none">5</span>
            <p class="font-ev text-[12px] text-ev-text-3 mt-1">familles de capteurs</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Panneau droit — Formulaire -->
    <div class="w-full lg:w-160 lg:shrink-0 flex items-center justify-center px-6 py-10">
      <div class="w-full max-w-md flex flex-col gap-8">
        <!-- En-tête mobile uniquement -->
        <div class="lg:hidden flex justify-center mb-4">
          <EvLogo :size="40" />
        </div>

        <div>
          <h2 class="font-ev text-[26px] font-bold tracking-tight">Accès au portail EnerVision</h2>
          <p class="font-ev text-sm text-ev-text-2 mt-2">
            Identifiants fournis par votre administrateur de site.
          </p>
        </div>

        <!-- Erreur globale -->
        <div
          v-if="errorMessage"
          class="bg-ev-red-bg border border-ev-red-bd rounded-ev-sm px-4 py-3 flex flex-col gap-1"
        >
          <span class="font-ev text-sm font-semibold text-(--ev-red)">Connexion refusée</span>
          <span class="font-ev text-[13px] text-ev-text-2">{{ errorMessage }}</span>
        </div>

        <UForm :schema="loginSchema" :state="state" class="flex flex-col gap-5" @submit="onSubmit">
          <UFormField label="Identifiant" name="email">
            <UInput
              v-model="state.email"
              type="email"
              placeholder="m.deschamps@enervision.eu"
              autocomplete="email"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Mot de passe" name="password">
            <UInput
              v-model="state.password"
              type="password"
              placeholder="••••••••••••"
              autocomplete="current-password"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <!-- TODO: forgotten password -->
          <div class="flex items-center justify-between">
            <!-- La case « Maintenir la session 8 h » de la maquette est retirée :
                 data.md fixe la durée à deux heures, et elle n'est pas réglable
                 par l'utilisateur. Une case qui ne fait rien et annonce une
                 durée fausse vaut moins que la durée écrite. -->
            <span class="font-ev text-[13px] text-ev-text-3">Session valable 2 heures</span>
            <a href="#" class="font-ev text-[13px] text-ev-green hover:text-ev-green-hover" @click.prevent>
              Mot de passe oublié ?
            </a>
          </div>

          <EvButton variant="primary" block :disabled="loading" type="submit">
            <template v-if="loading">Connexion…</template>
            <template v-else>Se connecter</template>
          </EvButton>
        </UForm>

        <div class="flex justify-center">
          <span class="inline-flex items-center gap-2 border border-ev-border rounded-ev-pill px-4 py-1.5">
            <span class="w-2 h-2 rounded-full bg-ev-green" />
            <span class="font-ev text-[12px] text-ev-text-3">Connexion chiffrée de bout en bout</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
