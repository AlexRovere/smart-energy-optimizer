// La vérité sur la session vit au serveur, pas dans le cookie : celui-ci ne
// porte qu'un identifiant opaque, illisible en JavaScript. Le navigateur ne
// peut donc pas déduire s'il est connecté, il le DEMANDE, et `useUserSession`
// de nuxt-auth-utils ne sert à rien ici pour la même raison.
export interface CompteConnecte {
  id: string
  email: string
  role: string
}

export function useSessionUtilisateur() {
  const compte = useState<CompteConnecte | null>('session-utilisateur', () => null)
  // Distingue « pas encore demandé » de « demandé, personne » : sans ce
  // drapeau, chaque navigation rejouerait la requête pour un visiteur anonyme.
  const demande = useState<boolean>('session-utilisateur-demande', () => false)

  async function rafraichir(): Promise<CompteConnecte | null> {
    // Pendant le rendu serveur, `$fetch` ne transmet pas les en-têtes de la
    // requête entrante : sans cette forme, le cookie ne suivrait pas et tout
    // visiteur paraîtrait anonyme au premier rendu.
    const requete = useRequestFetch()
    try {
      const { user } = await requete<{ user: CompteConnecte }>('/api/auth/session')
      compte.value = user
    }
    catch {
      compte.value = null
    }
    demande.value = true
    return compte.value
  }

  async function seDeconnecter(): Promise<void> {
    await $fetch('/api/auth/logout', { method: 'POST' })
    compte.value = null
    demande.value = true
    await navigateTo('/login')
  }

  return { compte, demande, rafraichir, seDeconnecter }
}
