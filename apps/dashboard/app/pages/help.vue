<script setup lang="ts">
import type { DataQuality } from '~/types/api'

// Les libellés viennent de utils/labels : l'aide et l'écran ne peuvent pas
// diverger sur le nom d'un niveau.
const QUALITIES: DataQuality[] = ['good', 'partial', 'degraded', 'critical']
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-7 flex flex-col gap-6 max-w-4xl">

    <header class="flex flex-col gap-1.5">
      <h2 class="font-ev text-[28px] font-bold tracking-tight">Aide</h2>
      <p class="font-ev text-sm text-ev-text-3">
        D'où viennent les chiffres affichés, et comment les lire.
      </p>
    </header>

    <EvCard>
      <template #title>
        <h3 class="font-ev text-base font-semibold">Charge et capacité</h3>
      </template>
      <div class="font-ev text-sm text-ev-text-2 flex flex-col gap-3 leading-relaxed">
        <p>
          La <strong>consommation</strong> est la puissance mesurée à l'instant sur le site, en kW. Elle vient
          directement des capteurs, relevés toutes les 30 secondes.
        </p>
        <p>
          La <strong>capacité</strong> est la puissance maximale prévue pour le site, en kW. Elle fait partie
          de la fiche du site et ne change pas d'une mesure à l'autre.
        </p>
        <p>
          La <strong>charge</strong> rapporte l'une à l'autre : un site qui consomme 300 kW pour une capacité
          de 600 kW est chargé à 50 %. La barre passe à l'orange à partir de 50 %, au rouge à partir de 80 %.
        </p>
        <p>
          Quand une mesure manque, la fiche d'un site affiche la dernière valeur connue avec la mention
          « valeur reportée » et son heure, plutôt qu'un tiret.
        </p>
      </div>
    </EvCard>

    <EvCard>
      <template #title>
        <h3 class="font-ev text-base font-semibold">Qualité des données</h3>
      </template>
      <div class="font-ev text-sm text-ev-text-2 flex flex-col gap-3 leading-relaxed">
        <p>
          Chaque mesure porte un niveau de qualité, qui dit combien de capteurs ont répondu. Il s'affiche
          dans le tableau des sites ; le survol du badge en rappelle le sens.
        </p>
        <dl class="flex flex-col gap-2.5">
          <div v-for="quality in QUALITIES" :key="quality" class="flex items-baseline gap-3">
            <dt class="shrink-0 w-24"><EvQualityBadge :quality="quality" /></dt>
            <dd>{{ qualityHint(quality) }}</dd>
          </div>
        </dl>
        <p>
          La <strong>santé</strong> d'un site (sain, dégradé, critique) résume l'état de ses cinq familles
          de capteurs : consommation, électrique, température, humidité et réseau. Un capteur en panne
          indique l'heure prévue de son retour.
        </p>
      </div>
    </EvCard>

    <EvCard>
      <template #title>
        <h3 class="font-ev text-base font-semibold">kW et kWh</h3>
      </template>
      <div class="font-ev text-sm text-ev-text-2 flex flex-col gap-3 leading-relaxed">
        <p>
          Le <strong>kW</strong> mesure une puissance, ce que le site consomme à un instant. Le
          <strong>kWh</strong> mesure une énergie, ce qu'il a consommé sur une durée.
        </p>
        <p>
          Les mesures sont horaires, et sur une heure les deux valeurs se confondent :
          120 kWh en une heure, c’est 120 kW en moyenne. C'est pourquoi les règles d'alerte de
          consommation s'expriment en kWh sur une fenêtre de plusieurs heures, alors que la consommation
          instantanée, la capacité et les prévisions s'affichent en kW.
        </p>
      </div>
    </EvCard>

    <EvCard>
      <template #title>
        <h3 class="font-ev text-base font-semibold">Alertes, seuils et recommandations</h3>
      </template>
      <div class="font-ev text-sm text-ev-text-2 flex flex-col gap-3 leading-relaxed">
        <p>
          Les <strong>alertes</strong> sont émises par la plateforme de collecte, par exemple pour un
          capteur en panne ou une consommation proche de la capacité. Elles portent une sévérité, de
          faible à critique.
        </p>
        <p>
          Les <strong>seuils</strong> se règlent par site dans les paramétrages, pour deux règles :
        </p>
        <ul class="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            <strong>Consommation</strong> : la moyenne sur une fenêtre glissante (5 heures par défaut)
            dépasse un seuil en kWh (200 kWh par défaut).
          </li>
          <li>
            <strong>Pic</strong> : la mesure dépasse la moyenne de la fenêtre glissante d'un facteur
            (1,5 par défaut, soit 50 % au-dessus).
          </li>
        </ul>
        <p>
          Une <strong>recommandation</strong> naît d'une règle franchie. Elle est soit constatée sur les
          mesures du jour, soit prévue dans les 48 heures à venir d'après le modèle ; dans ce second cas,
          son échéance est affichée. Si les mesures ou la prévision n'ont pas pu être consultées, la carte
          le dit (« Recommandations partielles ») plutôt que d'annoncer une absence d'anomalie.
        </p>
      </div>
    </EvCard>

    <EvCard>
      <template #title>
        <h3 class="font-ev text-base font-semibold">Prévisions</h3>
      </template>
      <div class="font-ev text-sm text-ev-text-2 flex flex-col gap-3 leading-relaxed">
        <p>
          La prévision est calculée à la demande, par le modèle en service (sa version est affichée), sur
          24 ou 48 heures. Au-delà, elle ne serait plus assez fiable pour décider d'une action.
        </p>
        <p>
          Le modèle a besoin des 168 dernières heures de mesures, soit une semaine sans interruption. S'il
          en manque, ou s'il n'y a pas encore de modèle entraîné, le motif s'affiche à la place de la courbe.
        </p>
      </div>
    </EvCard>

  </div>
</template>
