// Une session expire au bout de deux heures (nuxt.config.ts) : les routes
// d'API répondent alors 401, et sans ce plugin l'écran restait vide sans
// explication. Tout appel passe par $fetch, useFetch compris : l'envelopper
// une fois couvre toute l'application.
export default defineNuxtPlugin(() => {
  const router = useRouter()

  globalThis.$fetch = globalThis.$fetch.create({
    async onResponseError({ request, response }) {
      const { account } = useAccountSession()
      const url = typeof request === 'string' ? request : request.url
      const target = expiredSessionRedirect(
        url,
        response.status,
        account.value !== null,
        router.currentRoute.value.fullPath,
      )
      if (!target) return
      account.value = null
      await navigateTo(target)
    },
  })
})
