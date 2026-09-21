// Alerte pic évaluée sur l'horizon de prédiction ML (jusqu'à 168h), même détection que l'historique, contexte réel pour les premières heures (#176).
import { querySiteHistory } from './parquetReader'
import { getAlertThreshold } from './alertThresholdsRepository'
import { detectSpikeAlert } from './spikeAlertDetection'
import { fetchPredictions } from './mlClient'
import { hoursInHorizon } from './predictionHorizon'
import type { AppDatabase } from './session'
import type { TimestampedValue } from './rollingAverage'

const DÉFAUTS_PIC = { duration: 5, threshold: 1.5 }
const LIMITE_LECTURE = 1000

export interface HourlySpikeAlert {
  timestamp: string
  alert: boolean
}

export async function detectSpikeAlertsFromPredictions(
  db: AppDatabase,
  siteId: string,
  reference: Date,
  horizonHeures: number
): Promise<HourlySpikeAlert[]> {
  const réglage = await getAlertThreshold(db, siteId, 'pic', DÉFAUTS_PIC)
  const heures = hoursInHorizon(reference, horizonHeures)

  const début = new Date(reference.getTime() - réglage.duration * 3_600_000)
  const fin = new Date(reference.getTime() + 1)
  const contexte = await querySiteHistory(siteId, début.toISOString(), fin.toISOString(), LIMITE_LECTURE)

  const prédictions = await fetchPredictions(
    heures.map(heure => ({
      site_id: siteId,
      date: heure.toISOString().slice(0, 10),
      hour: heure.getUTCHours()
    }))
  )

  const valeursContexte: TimestampedValue[] = contexte
    .filter(mesure => mesure.consumption_kwh !== null && mesure.consumption_kwh !== undefined)
    .map(mesure => ({ timestamp: mesure.timestamp, value: mesure.consumption_kwh! }))
  const valeursPrédites: TimestampedValue[] = heures.map((heure, index) => ({
    timestamp: heure.toISOString(),
    value: prédictions[index]!.consumption_kwh
  }))

  return heures.map((heure, index) => {
    const précédentes = [...valeursContexte, ...valeursPrédites.slice(0, index)]
    return {
      timestamp: heure.toISOString(),
      alert: detectSpikeAlert(précédentes, heure, valeursPrédites[index]!.value, réglage)
    }
  })
}
