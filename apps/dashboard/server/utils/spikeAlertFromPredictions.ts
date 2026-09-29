// Alerte pic évaluée sur l'horizon de prédiction ML (jusqu'à 168h), même détection que l'historique, contexte réel pour les premières heures (#176).
import { querySiteHistory } from './parquetReader'
import { getAlertThreshold } from './alertThresholdsRepository'
import { detectSpikeAlert, type SpikeAlertEvaluation } from './spikeAlertDetection'
import { fetchPredictions } from './mlClient'
import { hoursInHorizon } from './predictionHorizon'
import type { AppDatabase } from './session'
import type { TimestampedValue } from './rollingAverage'

const SPIKE_DEFAULTS = { duration: 5, threshold: 1.5 }
const READ_LIMIT = 1000

export interface HourlySpikeAlert extends SpikeAlertEvaluation {
  timestamp: string
}

export async function detectSpikeAlertsFromPredictions(
  db: AppDatabase,
  siteId: string,
  reference: Date,
  horizonHours: number
): Promise<HourlySpikeAlert[]> {
  const setting = await getAlertThreshold(db, siteId, 'pic', SPIKE_DEFAULTS)
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

  return hours.map((hour, index) => {
    const previous = [...contextValues, ...predictedValues.slice(0, index)]
    return {
      timestamp: hour.toISOString(),
      ...detectSpikeAlert(previous, hour, predictedValues[index]!.value, setting)
    }
  })
}
