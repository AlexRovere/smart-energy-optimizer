// La vérité sur la session vit au serveur, pas dans le cookie : celui-ci ne
// porte qu'un identifiant opaque, illisible en JavaScript. Le navigateur ne
// peut donc pas déduire s'il est connecté, il le DEMANDE, et `useUserSession`
// de nuxt-auth-utils ne sert à rien ici pour la même raison.
export interface ConnectedAccount {
  id: string
  email: string
  role: string
  sites: string[]
}

export function useAccountSession() {
  const account = useState<ConnectedAccount | null>('session-utilisateur', () => null)
  // Distingue « pas encore demandé » de « demandé, personne » : sans ce
  // drapeau, chaque navigation rejouerait la requête pour un visiteur anonyme.
  const fetched = useState<boolean>('session-utilisateur-fetched', () => false)

  async function refresh(): Promise<ConnectedAccount | null> {
    // Pendant le rendu serveur, `$fetch` ne transmet pas les en-têtes de la
    // requête entrante : sans cette forme, le cookie ne suivrait pas et tout
    // visiteur paraîtrait anonyme au premier rendu.
    const request = useRequestFetch()
    try {
      const { user } = await request<{ user: ConnectedAccount }>('/api/auth/session')
      account.value = user
    }
    catch {
      account.value = null
    }
    fetched.value = true
    return account.value
  }

  async function logout(): Promise<void> {
    await $fetch('/api/auth/logout', { method: 'POST' })
    account.value = null
    fetched.value = true
    await navigateTo('/login')
  }

  return { account, fetched, refresh, logout }
}
