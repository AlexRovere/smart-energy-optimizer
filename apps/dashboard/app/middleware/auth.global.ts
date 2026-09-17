// Ce middleware range l'écran, il ne protège rien. La protection est au
// serveur : chaque route d'API relit la session en base et répond 401. Sans
// cela, il suffirait de désactiver JavaScript pour lire les données.
const ROUTES_PUBLIQUES = ['/login']

export default defineNuxtRouteMiddleware(async (to) => {
  const { compte, demande, rafraichir } = useSessionUtilisateur()

  if (!demande.value) {
    await rafraichir()
  }

  if (ROUTES_PUBLIQUES.includes(to.path)) return

  if (compte.value === null) {
    return navigateTo('/login')
  }
})
