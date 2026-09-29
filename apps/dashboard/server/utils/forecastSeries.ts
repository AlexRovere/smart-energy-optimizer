// Séries communes aux détections sur prévision (conso et pic) : les dernières
// mesures réelles, pour que les premières heures prévues aient un contexte, puis
// les heures prévues par le service ML sur l'horizon demandé.
import { fetchPredictions } from './mlClient'
import { querySiteHistory } from './parquetReader'
import { hoursInHorizon } from './predictionHorizon'
import type { TimestampedValue } from './rollingAverage'

const READ_LIMIT = 1000

export interface ForecastSeries {
  hours: Date[]
  contextValues: TimestampedValue[]
  predictedValues: TimestampedValue[]
}

export async function forecastSeries(
  siteId: string,
  reference: Date,
  horizonHours: number,
  contextHours: number
): Promise<ForecastSeries> {
  const hours = hoursInHorizon(reference, horizonHours)

  const startedAt = new Date(reference.getTime() - contextHours * 3_600_000)
  const finishedAt = new Date(reference.getTime() + 1)
  const context = await querySiteHistory(siteId, startedAt.toISOString(), finishedAt.toISOString(), READ_LIMIT)

  const forecastHours = await fetchPredictions(
    hours.map(hour => ({
      site_id: siteId,
      date: hour.toISOString().slice(0, 10),
      hour: hour.getUTCHours()
    }))
  )

  const contextValues = context
    .filter(reading => reading.consumption_kwh !== null && reading.consumption_kwh !== undefined)
    .map(reading => ({ timestamp: reading.timestamp, value: reading.consumption_kwh! }))
  const predictedValues = hours.map((hour, index) => ({
    timestamp: hour.toISOString(),
    value: forecastHours[index]!.consumption_kwh
  }))

  return { hours, contextValues, predictedValues }
}
