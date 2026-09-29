// Alerte conso évaluée sur l'historique Parquet réel, seuils lus en base (#175).
import { querySiteHistory } from './parquetReader'
import { getAlertThreshold } from './alertThresholdsRepository'
import { detectConsumptionAlert, type ConsumptionAlertEvaluation } from './consumptionAlertDetection'
import type { AppDatabase } from './session'
import type { TimestampedValue } from './rollingAverage'

const CONSUMPTION_DEFAULTS = { duration: 5, threshold: 200 }
const READ_LIMIT = 1000

export async function detectConsumptionAlertFromHistory(
  db: AppDatabase,
  siteId: string,
  reference: Date
): Promise<ConsumptionAlertEvaluation> {
  const setting = await getAlertThreshold(db, siteId, 'conso', CONSUMPTION_DEFAULTS)

  const startedAt = new Date(reference.getTime() - setting.duration * 3_600_000)
  const finishedAt = new Date(reference.getTime() + 1)
  const readingRows = await querySiteHistory(siteId, startedAt.toISOString(), finishedAt.toISOString(), READ_LIMIT)

  const values: TimestampedValue[] = readingRows
    .filter(reading => reading.consumption_kwh !== null && reading.consumption_kwh !== undefined)
    .map(reading => ({ timestamp: reading.timestamp, value: reading.consumption_kwh! }))

  return detectConsumptionAlert(values, reference, setting)
}
