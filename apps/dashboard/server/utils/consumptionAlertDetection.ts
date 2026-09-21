// Détection de l'alerte conso : moyenne glissante de consommation comparée au seuil réglé (#175, #177).
import { rollingAverage, type TimestampedValue } from './rollingAverage'
import type { AlertThreshold } from './alertThresholdsRepository'

export interface ConsumptionAlertEvaluation {
  alert: boolean
  average: number | null
  thresholdKwh: number
}

export function detectConsumptionAlert(
  valeurs: TimestampedValue[],
  reference: Date,
  réglage: AlertThreshold
): ConsumptionAlertEvaluation {
  const moyenne = rollingAverage(valeurs, reference, réglage.duration)
  return {
    alert: moyenne !== null && moyenne >= réglage.threshold,
    average: moyenne,
    thresholdKwh: réglage.threshold
  }
}
