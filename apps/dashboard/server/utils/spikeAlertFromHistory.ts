// Alerte pic évaluée sur l'historique Parquet réel, seuils lus en base (#176).
import { querySiteHistory } from './parquetReader'
import { getAlertThreshold } from './alertThresholdsRepository'
import { detectSpikeAlert, type SpikeAlertEvaluation } from './spikeAlertDetection'
import type { AppDatabase } from './session'
import type { TimestampedValue } from './rollingAverage'

const DÉFAUTS_PIC = { duration: 5, threshold: 1.5 }
const LIMITE_LECTURE = 1000
const AUCUNE_DONNÉE: SpikeAlertEvaluation = {
  alert: false,
  currentValue: null,
  average: null,
  thresholdKw: null
}

export async function detectSpikeAlertFromHistory(
  db: AppDatabase,
  siteId: string,
  reference: Date
): Promise<SpikeAlertEvaluation> {
  const réglage = await getAlertThreshold(db, siteId, 'pic', DÉFAUTS_PIC)

  const début = new Date(reference.getTime() - réglage.duration * 3_600_000)
  const fin = new Date(reference.getTime() + 1)
  const mesures = await querySiteHistory(siteId, début.toISOString(), fin.toISOString(), LIMITE_LECTURE)

  const valeurs: TimestampedValue[] = mesures
    .filter(mesure => mesure.consumption_kwh !== null && mesure.consumption_kwh !== undefined)
    .map(mesure => ({ timestamp: mesure.timestamp, value: mesure.consumption_kwh! }))

  const dernière = valeurs.at(-1)
  if (dernière === undefined) return AUCUNE_DONNÉE

  const précédentes = valeurs.slice(0, -1)
  return detectSpikeAlert(précédentes, reference, dernière.value, réglage)
}
