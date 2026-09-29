// Heures de l'horizon de prédiction, partagées par la détection conso et pic (#175, #176).
// Les heures partent de l'heure pleine qui suit la référence : le ML prévoit
// par heure ronde, et une échéance à 09:41:52 ne correspondrait à aucune prévision.
export function hoursInHorizon(reference: Date, horizonHeures: number): Date[] {
  const heurePleine = Math.floor(reference.getTime() / 3_600_000) * 3_600_000
  return Array.from(
    { length: horizonHeures },
    (_, index) => new Date(heurePleine + (index + 1) * 3_600_000)
  )
}
