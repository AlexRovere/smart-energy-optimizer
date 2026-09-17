// Ce que l'écran a le droit de dire, et rien de plus. Le serveur répond la même
// chose pour un compte inconnu et pour un mot de passe faux ; l'écran ne doit
// pas rétablir la distinction, sinon la page de connexion redevient un annuaire
// des comptes.
export function messageDeConnexion(statut: number, retryAfterSecondes?: number): string {
  if (statut === 401) return 'Identifiants invalides.'
  if (statut === 422) return 'Vérifiez votre adresse et votre mot de passe.'

  if (statut === 429) {
    if (retryAfterSecondes === undefined || retryAfterSecondes <= 0) {
      return 'Trop de tentatives. Réessayez plus tard.'
    }
    // Arrondi à la minute SUPÉRIEURE : annoncer « dans 0 minute » pour trente
    // secondes ferait réessayer tout de suite, donc échouer à nouveau.
    const minutes = Math.ceil(retryAfterSecondes / 60)
    return `Trop de tentatives. Réessayez dans ${minutes} ${minutes > 1 ? 'minutes' : 'minute'}.`
  }

  return 'Service indisponible. Réessayez dans un instant.'
}
