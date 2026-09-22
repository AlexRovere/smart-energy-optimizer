// Moyenne glissante partagée par la détection d'alerte conso et pic, agnostique de la source des valeurs (Parquet ou prédictions ML).
export interface TimestampedValue {
  timestamp: string
  value: number
}

export function rollingAverage(
  valeurs: TimestampedValue[],
  reference: Date,
  dureeHeures: number
): number | null {
  const début = reference.getTime() - dureeHeures * 3_600_000
  const fenêtre = valeurs.filter(({ timestamp }) => {
    const instant = new Date(timestamp).getTime()
    return instant > début && instant <= reference.getTime()
  })

  if (fenêtre.length === 0) return null
  return fenêtre.reduce((somme, { value }) => somme + value, 0) / fenêtre.length
}
