// Ce middleware range l'écran, il ne protège rien. La protection est au
// serveur : chaque route d'API relit la session en base et répond 401. Sans
// cela, il suffirait de désactiver JavaScript pour lire les données.
const PUBLIC_ROUTES = new Set(['/login'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { account, fetched, refresh } = useAccountSession()

  if (!fetched.value) {
    await refresh()
  }

  if (PUBLIC_ROUTES.has(to.path)) return

  if (account.value === null) {
    return navigateTo('/login')
  }
})
