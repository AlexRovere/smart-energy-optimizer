// Détection de l'alerte conso : moyenne glissante de consommation comparée au seuil réglé (#175).
import { rollingAverage, type TimestampedValue } from './rollingAverage'
import type { AlertThreshold } from './alertThresholdsRepository'

export function detectConsumptionAlert(
  valeurs: TimestampedValue[],
  reference: Date,
  réglage: AlertThreshold
): boolean {
  const moyenne = rollingAverage(valeurs, reference, réglage.duration)
  return moyenne !== null && moyenne >= réglage.threshold
}
