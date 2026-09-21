// Alerte conso évaluée sur l'horizon de prédiction ML (jusqu'à 168h), même détection que l'historique, contexte réel pour les premières heures (#175).
import { querySiteHistory } from './parquetReader'
import { getAlertThreshold } from './alertThresholdsRepository'
import { detectConsumptionAlert } from './consumptionAlertDetection'
import { fetchPredictions } from './mlClient'
import type { AppDatabase } from './session'
import type { TimestampedValue } from './rollingAverage'

const DÉFAUTS_CONSO = { duration: 5, threshold: 200 }
const LIMITE_LECTURE = 1000

export interface HourlyConsumptionAlert {
  timestamp: string
  alert: boolean
}

function heuresDeLHorizon(reference: Date, horizonHeures: number): Date[] {
  return Array.from(
    { length: horizonHeures },
    (_, index) => new Date(reference.getTime() + (index + 1) * 3_600_000)
  )
}

export async function detectConsumptionAlertsFromPredictions(
  db: AppDatabase,
  siteId: string,
  reference: Date,
  horizonHeures: number
): Promise<HourlyConsumptionAlert[]> {
  const réglage = await getAlertThreshold(db, siteId, 'conso', DÉFAUTS_CONSO)
  const heures = heuresDeLHorizon(reference, horizonHeures)

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
  const valeurs = [...valeursContexte, ...valeursPrédites]

  return heures.map(heure => ({
    timestamp: heure.toISOString(),
    alert: detectConsumptionAlert(valeurs, heure, réglage)
  }))
}
