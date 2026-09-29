// Traduit un échec du service ML en réponse lisible : un 503 muet laissait
// croire à une panne quand il manquait seulement de l'historique (#6).
const MODEL_UNAVAILABLE_DETAIL = 'Aucun modèle champion disponible' // apps/ml/src/api/main.py

export function predictionFailure(error: unknown): { status: number; message: string } {
  const failure = error as { statusCode?: number; data?: { detail?: unknown } } | null
  const status = failure?.statusCode
  if (status === 422) {
    return { status: 422, message: 'Historique insuffisant ou trop ancien pour prévoir' }
  }
  if (status === 503) {
    return failure?.data?.detail === MODEL_UNAVAILABLE_DETAIL
      ? { status: 503, message: 'Aucun modèle entraîné disponible' }
      : { status: 503, message: 'Historique illisible par le service de prédiction' }
  }
  return { status: 503, message: 'Service de prédiction indisponible' }
}
