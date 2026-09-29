// Moyenne glissante partagée par la détection d'alerte conso et pic, agnostique de la source des valeurs (Parquet ou prédictions ML).
export interface TimestampedValue {
  timestamp: string
  value: number
}

export function rollingAverage(
  values: TimestampedValue[],
  reference: Date,
  durationHours: number
): number | null {
  const startedAt = reference.getTime() - durationHours * 3_600_000
  const timeWindow = values.filter(({ timestamp }) => {
    const instant = new Date(timestamp).getTime()
    return instant > startedAt && instant <= reference.getTime()
  })

  if (timeWindow.length === 0) return null
  return timeWindow.reduce((sum, { value }) => sum + value, 0) / timeWindow.length
}
