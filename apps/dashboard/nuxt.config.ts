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
    parquetDirExpose: '',
    mlServiceUrl: '',
    logLevel: 'info'
  },
  typescript: {
    strict: true,
    typeCheck: false,
    includeWorkspace: true
  },
  css: ['~/assets/css/main.css']
})
