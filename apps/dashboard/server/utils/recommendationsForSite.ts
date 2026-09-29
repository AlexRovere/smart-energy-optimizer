// Recommandations d'un site : détecte réellement (#175, #176) puis mappe chaque déclenchement (#177).
import { detectConsumptionAlertFromHistory } from './consumptionAlertFromHistory'
import { detectSpikeAlertFromHistory } from './spikeAlertFromHistory'
import { detectConsumptionAlertsFromPredictions } from './consumptionAlertFromPredictions'
import { detectSpikeAlertsFromPredictions } from './spikeAlertFromPredictions'
import { buildRecommendation } from './recommendationFromAlert'
import type { AppDatabase } from './session'
import type { Recommendation, RecommendationPriority } from '../../shared/recommendationSchema'

// Au-delà de deux jours, une alerte n'est plus actionnable, et la prédiction
// autorégressive accumule ses biais (#6, décision du 23 septembre 2026).
const HORIZON_PRÉVISION_HEURES = 48

export type MissingSource = 'history' | 'forecast'

export interface SiteRecommendations {
  recommendations: Recommendation[]
  // Ce qui n'a pas pu être consulté : une liste vide avec des sources
  // manquantes n'est pas « aucune anomalie », l'écran doit le dire.
  unavailable: MissingSource[]
}

type Outcome = { recommendation: Recommendation | null; missing: MissingSource | null }

export async function recommendationsForSite(
  db: AppDatabase,
  siteId: string,
  reference: Date
): Promise<SiteRecommendations> {
  const outcomes = [
    await recommendationConso(db, siteId, reference),
    await recommendationPic(db, siteId, reference),
  ]

  const ORDRE_PRIORITÉ: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 }
  const recommendations = outcomes
    .flatMap(o => (o.recommendation ? [o.recommendation] : []))
    .sort((a, b) => ORDRE_PRIORITÉ[a.priority] - ORDRE_PRIORITÉ[b.priority])
  const unavailable = [...new Set(outcomes.flatMap(o => (o.missing ? [o.missing] : [])))]

  return { recommendations, unavailable }
}

async function recommendationConso(db: AppDatabase, siteId: string, reference: Date): Promise<Outcome> {
  let aujourdHui
  try {
    aujourdHui = await detectConsumptionAlertFromHistory(db, siteId, reference)
  } catch {
    return { recommendation: null, missing: 'history' }
  }

  if (aujourdHui.alert) {
    return {
      recommendation: buildRecommendation(siteId, 'conso', 'threshold', {
        timestamp: reference.toISOString(),
        valueKw: aujourdHui.average!,
        thresholdKw: aujourdHui.thresholdKwh
      }),
      missing: null,
    }
  }

  try {
    const prévisions = await detectConsumptionAlertsFromPredictions(db, siteId, reference, HORIZON_PRÉVISION_HEURES)
    const première = prévisions.find(heure => heure.alert)
    if (!première) return { recommendation: null, missing: null }

    return {
      recommendation: buildRecommendation(siteId, 'conso', 'forecast', {
        timestamp: première.timestamp,
        valueKw: première.average!,
        thresholdKw: première.thresholdKwh
      }),
      missing: null,
    }
  } catch {
    return { recommendation: null, missing: 'forecast' }
  }
}

async function recommendationPic(db: AppDatabase, siteId: string, reference: Date): Promise<Outcome> {
  let aujourdHui
  try {
    aujourdHui = await detectSpikeAlertFromHistory(db, siteId, reference)
  } catch {
    return { recommendation: null, missing: 'history' }
  }

  if (aujourdHui.alert) {
    return {
      recommendation: buildRecommendation(siteId, 'pic', 'threshold', {
        timestamp: reference.toISOString(),
        valueKw: aujourdHui.currentValue!,
        thresholdKw: aujourdHui.thresholdKw!
      }),
      missing: null,
    }
  }

  try {
    const prévisions = await detectSpikeAlertsFromPredictions(db, siteId, reference, HORIZON_PRÉVISION_HEURES)
    const première = prévisions.find(heure => heure.alert)
    if (!première) return { recommendation: null, missing: null }

    return {
      recommendation: buildRecommendation(siteId, 'pic', 'forecast', {
        timestamp: première.timestamp,
        valueKw: première.currentValue!,
        thresholdKw: première.thresholdKw!
      }),
      missing: null,
    }
  } catch {
    return { recommendation: null, missing: 'forecast' }
  }
}
