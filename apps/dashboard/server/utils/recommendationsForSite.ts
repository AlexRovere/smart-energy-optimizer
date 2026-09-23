// Recommandations d'un site : détecte réellement (#175, #176) puis mappe chaque déclenchement (#177).
import { detectConsumptionAlertFromHistory } from './consumptionAlertFromHistory'
import { detectSpikeAlertFromHistory } from './spikeAlertFromHistory'
import { detectConsumptionAlertsFromPredictions } from './consumptionAlertFromPredictions'
import { detectSpikeAlertsFromPredictions } from './spikeAlertFromPredictions'
import { buildRecommendation } from './recommendationFromAlert'
import type { AppDatabase } from './session'
import type { Recommendation, RecommendationPriority } from '../../shared/recommendationSchema'

const HORIZON_PRÉVISION_HEURES = 168

export async function recommendationsForSite(
  db: AppDatabase,
  siteId: string,
  reference: Date
): Promise<Recommendation[]> {
  const recommandations: Recommendation[] = []

  const conso = await recommendationConso(db, siteId, reference)
  if (conso) recommandations.push(conso)

  const pic = await recommendationPic(db, siteId, reference)
  if (pic) recommandations.push(pic)

  const ORDRE_PRIORITÉ: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 }
  recommandations.sort((a, b) => ORDRE_PRIORITÉ[a.priority] - ORDRE_PRIORITÉ[b.priority])

  return recommandations
}

async function recommendationConso(
  db: AppDatabase,
  siteId: string,
  reference: Date
): Promise<Recommendation | null> {
  const aujourdHui = await detectConsumptionAlertFromHistory(db, siteId, reference)
  if (aujourdHui.alert) {
    return buildRecommendation(siteId, 'conso', 'threshold', {
      timestamp: reference.toISOString(),
      valueKw: aujourdHui.average!,
      thresholdKw: aujourdHui.thresholdKwh
    })
  }

  const prévisions = await detectConsumptionAlertsFromPredictions(db, siteId, reference, HORIZON_PRÉVISION_HEURES)
  const première = prévisions.find(heure => heure.alert)
  if (!première) return null

  return buildRecommendation(siteId, 'conso', 'forecast', {
    timestamp: première.timestamp,
    valueKw: première.average!,
    thresholdKw: première.thresholdKwh
  })
}

async function recommendationPic(
  db: AppDatabase,
  siteId: string,
  reference: Date
): Promise<Recommendation | null> {
  const aujourdHui = await detectSpikeAlertFromHistory(db, siteId, reference)
  if (aujourdHui.alert) {
    return buildRecommendation(siteId, 'pic', 'threshold', {
      timestamp: reference.toISOString(),
      valueKw: aujourdHui.currentValue!,
      thresholdKw: aujourdHui.thresholdKw!
    })
  }

  const prévisions = await detectSpikeAlertsFromPredictions(db, siteId, reference, HORIZON_PRÉVISION_HEURES)
  const première = prévisions.find(heure => heure.alert)
  if (!première) return null

  return buildRecommendation(siteId, 'pic', 'forecast', {
    timestamp: première.timestamp,
    valueKw: première.currentValue!,
    thresholdKw: première.thresholdKw!
  })
}

