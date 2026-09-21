// Alerte conso évaluée sur l'historique Parquet réel, seuils lus en base (#175).
import { querySiteHistory } from './parquetReader'
import { getAlertThreshold } from './alertThresholdsRepository'
import { detectConsumptionAlert } from './consumptionAlertDetection'
import type { AppDatabase } from './session'
import type { TimestampedValue } from './rollingAverage'

const DÉFAUTS_CONSO = { duration: 5, threshold: 200 }
const LIMITE_LECTURE = 1000

export async function detectConsumptionAlertFromHistory(
  db: AppDatabase,
  siteId: string,
  reference: Date
): Promise<boolean> {
  const réglage = await getAlertThreshold(db, siteId, 'conso', DÉFAUTS_CONSO)

  const début = new Date(reference.getTime() - réglage.duration * 3_600_000)
  const fin = new Date(reference.getTime() + 1)
  const mesures = await querySiteHistory(siteId, début.toISOString(), fin.toISOString(), LIMITE_LECTURE)

  const valeurs: TimestampedValue[] = mesures
    .filter(mesure => mesure.consumption_kwh !== null && mesure.consumption_kwh !== undefined)
    .map(mesure => ({ timestamp: mesure.timestamp, value: mesure.consumption_kwh! }))

  return detectConsumptionAlert(valeurs, reference, réglage)
}
