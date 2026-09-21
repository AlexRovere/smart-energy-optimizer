// Détection de l'alerte pic : valeur courante comparée à la moyenne glissante précédente × facteur de seuil (#176).
import { rollingAverage, type TimestampedValue } from './rollingAverage'
import type { AlertThreshold } from './alertThresholdsRepository'

export function detectSpikeAlert(
  valeursPrécédentes: TimestampedValue[],
  reference: Date,
  valeurCourante: number,
  réglage: AlertThreshold
): boolean {
  const moyenne = rollingAverage(valeursPrécédentes, reference, réglage.duration)
  return moyenne !== null && valeurCourante >= moyenne * réglage.threshold
}
