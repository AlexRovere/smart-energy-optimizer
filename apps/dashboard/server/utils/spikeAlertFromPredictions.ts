// Alerte pic évaluée sur l'horizon de prédiction ML, même détection que l'historique, contexte réel pour les premières heures (#176).
import { getAlertThreshold } from './alertThresholdsRepository'
import { forecastSeries } from './forecastSeries'
import { detectSpikeAlert, type SpikeAlertEvaluation } from './spikeAlertDetection'
import type { AppDatabase } from './session'

const SPIKE_DEFAULTS = { duration: 5, threshold: 1.5 }

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
  const { hours, contextValues, predictedValues } = await forecastSeries(siteId, reference, horizonHours, setting.duration)

  return hours.map((hour, index) => {
    const previous = [...contextValues, ...predictedValues.slice(0, index)]
    return {
      timestamp: hour.toISOString(),
      ...detectSpikeAlert(previous, hour, predictedValues[index]!.value, setting)
    }
  })
}
