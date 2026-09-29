const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  OPERATOR: 'Opérateur',
  VIEWER: 'Lecteur',
}

// Un rôle inconnu s'affiche tel quel : un libellé vide cacherait un compte
// dont le rôle a été ajouté en base sans que l'interface le connaisse.
export function roleLabel(role: string | undefined): string {
  if (!role) return ''
  return ROLE_LABELS[role] ?? role
}
