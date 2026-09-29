// Alerte pic évaluée sur l'historique Parquet réel, seuils lus en base (#176).
import { querySiteHistory } from './parquetReader'
import { getAlertThreshold } from './alertThresholdsRepository'
import { detectSpikeAlert, type SpikeAlertEvaluation } from './spikeAlertDetection'
import type { AppDatabase } from './session'
import type { TimestampedValue } from './rollingAverage'

const SPIKE_DEFAULTS = { duration: 5, threshold: 1.5 }
const READ_LIMIT = 1000
const NO_DATA: SpikeAlertEvaluation = {
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
  const setting = await getAlertThreshold(db, siteId, 'pic', SPIKE_DEFAULTS)

  const startedAt = new Date(reference.getTime() - setting.duration * 3_600_000)
  const finishedAt = new Date(reference.getTime() + 1)
  const readingRows = await querySiteHistory(siteId, startedAt.toISOString(), finishedAt.toISOString(), READ_LIMIT)

  const values: TimestampedValue[] = readingRows
    .filter(reading => reading.consumption_kwh !== null && reading.consumption_kwh !== undefined)
    .map(reading => ({ timestamp: reading.timestamp, value: reading.consumption_kwh! }))

  const latest = values.at(-1)
  if (latest === undefined) return NO_DATA

  const previous = values.slice(0, -1)
  return detectSpikeAlert(previous, reference, latest.value, setting)
}
