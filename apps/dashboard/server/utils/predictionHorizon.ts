// Heures de l'horizon de prédiction, partagées par la détection conso et pic (#175, #176).
export function hoursInHorizon(reference: Date, horizonHeures: number): Date[] {
  return Array.from(
    { length: horizonHeures },
    (_, index) => new Date(reference.getTime() + (index + 1) * 3_600_000)
  )
}
