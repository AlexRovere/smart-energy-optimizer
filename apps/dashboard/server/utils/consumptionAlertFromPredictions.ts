// Alerte conso évaluée sur l'horizon de prédiction ML (jusqu'à 168h), même détection que l'historique, contexte réel pour les premières heures (#175).
import { querySiteHistory } from './parquetReader'
import { getAlertThreshold } from './alertThresholdsRepository'
import { detectConsumptionAlert, type ConsumptionAlertEvaluation } from './consumptionAlertDetection'
import { fetchPredictions } from './mlClient'
import { hoursInHorizon } from './predictionHorizon'
import type { AppDatabase } from './session'
import type { TimestampedValue } from './rollingAverage'

const CONSUMPTION_DEFAULTS = { duration: 5, threshold: 200 }
const READ_LIMIT = 1000

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
  const hours = hoursInHorizon(reference, horizonHours)

  const startedAt = new Date(reference.getTime() - setting.duration * 3_600_000)
  const finishedAt = new Date(reference.getTime() + 1)
  const context = await querySiteHistory(siteId, startedAt.toISOString(), finishedAt.toISOString(), READ_LIMIT)

  const forecastHours = await fetchPredictions(
    hours.map(hour => ({
      site_id: siteId,
      date: hour.toISOString().slice(0, 10),
      hour: hour.getUTCHours()
    }))
  )

  const contextValues: TimestampedValue[] = context
    .filter(reading => reading.consumption_kwh !== null && reading.consumption_kwh !== undefined)
    .map(reading => ({ timestamp: reading.timestamp, value: reading.consumption_kwh! }))
  const predictedValues: TimestampedValue[] = hours.map((hour, index) => ({
    timestamp: hour.toISOString(),
    value: forecastHours[index]!.consumption_kwh
  }))
  const values = [...contextValues, ...predictedValues]

  return hours.map(hour => ({
    timestamp: hour.toISOString(),
    ...detectConsumptionAlert(values, hour, setting)
  }))
}
