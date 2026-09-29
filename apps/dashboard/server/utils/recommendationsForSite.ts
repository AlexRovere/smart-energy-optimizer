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
const FORECAST_HORIZON_HOURS = 48

export type MissingSource = 'history' | 'forecast'

export interface SiteRecommendations {
  recommendations: Recommendation[]
  // Ce qui n'a pas pu être consulté : une liste vide avec des sources
  // manquantes n'est pas « aucune anomalie », l'écran doit le dire.
  unavailable: MissingSource[]
}

// Une recommandation constatée est datée de son heure pleine : son identifiant
// en dépend, et il doit rester le même d'un chargement à l'autre pour qu'un
// vote « utile / pas utile » s'y rattache (#47).
function observedHour(reference: Date): string {
  return new Date(Math.floor(reference.getTime() / 3_600_000) * 3_600_000).toISOString()
}

type Outcome = { recommendation: Recommendation | null; missing: MissingSource | null }

export async function recommendationsForSite(
  db: AppDatabase,
  siteId: string,
  reference: Date
): Promise<SiteRecommendations> {
  const outcomes = [
    await consumptionRecommendation(db, siteId, reference),
    await recommendationPic(db, siteId, reference),
  ]

  const PRIORITY_ORDER: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 }
  const recommendations = outcomes
    .flatMap(o => (o.recommendation ? [o.recommendation] : []))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  const unavailable = [...new Set(outcomes.flatMap(o => (o.missing ? [o.missing] : [])))]

  return { recommendations, unavailable }
}

async function consumptionRecommendation(db: AppDatabase, siteId: string, reference: Date): Promise<Outcome> {
  let today
  try {
    today = await detectConsumptionAlertFromHistory(db, siteId, reference)
  } catch {
    return { recommendation: null, missing: 'history' }
  }

  if (today.alert) {
    return {
      recommendation: buildRecommendation(siteId, 'conso', 'threshold', {
        timestamp: observedHour(reference),
        valueKw: today.average!,
        thresholdKw: today.thresholdKwh
      }),
      missing: null,
    }
  }

  try {
    const forecasts = await detectConsumptionAlertsFromPredictions(db, siteId, reference, FORECAST_HORIZON_HOURS)
    const first = forecasts.find(hour => hour.alert)
    if (!first) return { recommendation: null, missing: null }

    return {
      recommendation: buildRecommendation(siteId, 'conso', 'forecast', {
        timestamp: first.timestamp,
        valueKw: first.average!,
        thresholdKw: first.thresholdKwh
      }),
      missing: null,
    }
  } catch {
    return { recommendation: null, missing: 'forecast' }
  }
}

async function recommendationPic(db: AppDatabase, siteId: string, reference: Date): Promise<Outcome> {
  let today
  try {
    today = await detectSpikeAlertFromHistory(db, siteId, reference)
  } catch {
    return { recommendation: null, missing: 'history' }
  }

  if (today.alert) {
    return {
      recommendation: buildRecommendation(siteId, 'pic', 'threshold', {
        timestamp: observedHour(reference),
        valueKw: today.currentValue!,
        thresholdKw: today.thresholdKw!
      }),
      missing: null,
    }
  }

  try {
    const forecasts = await detectSpikeAlertsFromPredictions(db, siteId, reference, FORECAST_HORIZON_HOURS)
    const first = forecasts.find(hour => hour.alert)
    if (!first) return { recommendation: null, missing: null }

    return {
      recommendation: buildRecommendation(siteId, 'pic', 'forecast', {
        timestamp: first.timestamp,
        valueKw: first.currentValue!,
        thresholdKw: first.thresholdKw!
      }),
      missing: null,
    }
  } catch {
    return { recommendation: null, missing: 'forecast' }
  }
}
