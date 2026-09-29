// Détection de l'alerte conso : moyenne glissante de consommation comparée au seuil réglé (#175, #177).
import { rollingAverage, type TimestampedValue } from './rollingAverage'
import type { AlertThreshold } from './alertThresholdsRepository'

export interface ConsumptionAlertEvaluation {
  alert: boolean
  average: number | null
  thresholdKwh: number
}

export function detectConsumptionAlert(
  values: TimestampedValue[],
  reference: Date,
  setting: AlertThreshold
): ConsumptionAlertEvaluation {
  const mean = rollingAverage(values, reference, setting.duration)
  return {
    alert: mean !== null && mean >= setting.threshold,
    average: mean,
    thresholdKwh: setting.threshold
  }
}
