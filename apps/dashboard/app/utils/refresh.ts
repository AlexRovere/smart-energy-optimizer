function hhmm(at: number): string {
  return new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// `refreshedAt` est l'heure de la dernière réponse reçue, pas l'horodatage de
// la source : celui-ci avance à l'heure, et l'affichage semblait figé.
export function refreshLabel(refreshedAt: number | null, failed: boolean): string {
  if (refreshedAt == null) return failed ? 'Données indisponibles' : 'Chargement…'
  return failed
    ? `Échec de l'actualisation, données de ${hhmm(refreshedAt)}`
    : `Actualisé à ${hhmm(refreshedAt)}`
}
