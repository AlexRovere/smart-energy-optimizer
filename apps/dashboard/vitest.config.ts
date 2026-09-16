import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    globalSetup: ['./tests/database/global-setup.ts'],
    // Le premier demarrage tire l'image postgres:16-alpine : large, et une
    // seule fois. Les delais par defaut de Vitest sont de 5 s.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Un fichier de test a la fois. Chaque fichier a sa propre BASE, donc les
    // tables sont isolees, mais un ROLE PostgreSQL est global au cluster : deux
    // fichiers qui posent chacun un mot de passe au role etl se marcheraient
    // dessus, et l'echec serait intermittent, donc long a diagnostiquer.
    fileParallelism: false
  }
})
