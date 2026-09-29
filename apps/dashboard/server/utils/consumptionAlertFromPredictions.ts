// Alerte conso évaluée sur l'horizon de prédiction ML, même détection que l'historique, contexte réel pour les premières heures (#175).
import { getAlertThreshold } from './alertThresholdsRepository'
import { detectConsumptionAlert, type ConsumptionAlertEvaluation } from './consumptionAlertDetection'
import { forecastSeries } from './forecastSeries'
import type { AppDatabase } from './session'

const CONSUMPTION_DEFAULTS = { duration: 5, threshold: 200 }

export interface HourlyConsumptionAlert extends ConsumptionAlertEvaluation {
  timestamp: string
}

export async function detectConsumptionAlertsFromPredictions(
  db: AppDatabase,
  siteId: string,
  reference: Date,
  horizonHours: number
): Promise<HourlyConsumptionAlert[]> {
  const setting = await getAlertThreshold(db, siteId, 'conso', CONSUMPTION_DEFAULTS)
  const { hours, contextValues, predictedValues } = await forecastSeries(siteId, reference, horizonHours, setting.duration)
  const values = [...contextValues, ...predictedValues]

  return hours.map(hour => ({
    timestamp: hour.toISOString(),
    ...detectConsumptionAlert(values, hour, setting)
  }))
}
