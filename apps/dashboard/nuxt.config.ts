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
    sessionSecret: '',
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
