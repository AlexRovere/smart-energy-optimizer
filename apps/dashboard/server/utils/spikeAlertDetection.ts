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
  valeursPrécédentes: TimestampedValue[],
  reference: Date,
  valeurCourante: number,
  réglage: AlertThreshold
): SpikeAlertEvaluation {
  const moyenne = rollingAverage(valeursPrécédentes, reference, réglage.duration)
  const seuilKw = moyenne !== null ? moyenne * réglage.threshold : null
  return {
    alert: seuilKw !== null && valeurCourante >= seuilKw,
    currentValue: valeurCourante,
    average: moyenne,
    thresholdKw: seuilKw
  }
}
