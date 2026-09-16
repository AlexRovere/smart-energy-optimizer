export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  /**
   * Redirect OK - Pour dev on éteint le middleware
   * TODO: quand backend + auth OK, supprimer cette ligne
   */
  const dev = ref(true)
  if (dev.value) return

  const publicRoutes = ['/login']
  if (publicRoutes.includes(to.path)) return

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})