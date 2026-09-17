// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils'
  ],
  runtimeConfig: {
    // `nuxt-auth-utils` lit `session.password`, alimenté par
    // NUXT_SESSION_PASSWORD. La clé `sessionSecret` qui vivait ici n'était lue
    // par personne : le module tournait donc avec un mot de passe vide.
    //
    // Les attributs du cookie sont écrits alors que ce sont déjà les défauts de
    // h3 et du module. Ils SONT le critère de #29 (« HttpOnly, Secure et
    // SameSite »), et un critère de sécurité qui dépend du défaut d'une
    // bibliothèque change le jour où la bibliothèque change d'avis.
    session: {
      name: 'enervision_session',
      // Secondes, à tenir en accord avec DUREE_SESSION_MS de
      // server/utils/session.ts : le cookie et la ligne en base doivent mourir
      // ensemble, sinon l'un des deux survit sans l'autre.
      maxAge: 2 * 60 * 60,
      cookie: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax' as const,
        path: '/'
      }
    },
    // Faux tant que l'applicatif est joignable en direct. Passe à vrai le jour
    // où le proxy de #39 est SEUL à pouvoir l'atteindre, et pas avant : c'est
    // ce drapeau qui autorise la limitation par IP à croire X-Forwarded-For.
    trustProxy: false,
    databaseUrl: '',
    mockApiUrl: '',
    parquetDir: '',
    mlServiceUrl: '',
    logLevel: 'info'
  },
  app: {
    head: {
      title: 'EnerVision',
      htmlAttrs: {
        lang: 'fr',
      },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
    includeWorkspace: true
  },
  css: ['~/assets/css/main.css']
})
