// Détection de l'alerte pic : valeur courante comparée à la moyenne glissante précédente × facteur de seuil (#176, #177).
import { rollingAverage, type TimestampedValue } from './rollingAverage'
import type { AlertThreshold } from './alertThresholdsRepository'

export interface SpikeAlertEvaluation {
  alert: boolean
  currentValue: number | null
  average: number | null
  thresholdKw: number | null
}

export function detectSpikeAlert(
  previousValues: TimestampedValue[],
  reference: Date,
  currentValue: number,
  setting: AlertThreshold
): SpikeAlertEvaluation {
  const mean = rollingAverage(previousValues, reference, setting.duration)
  const thresholdKw = mean !== null ? mean * setting.threshold : null
  return {
    alert: thresholdKw !== null && currentValue >= thresholdKw,
    currentValue: currentValue,
    average: mean,
    thresholdKw: thresholdKw
  }
}
