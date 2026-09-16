import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    globalSetup: ['./tests/database/global-setup.ts'],
    // Le premier démarrage tire l'image postgres:16-alpine : large, et une
    // seule fois. Les délais par défaut de Vitest sont de 5 s.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Un fichier de test à la fois. Chaque fichier a sa propre BASE, donc les
    // tables sont isolées, mais un RÔLE PostgreSQL est global au cluster : deux
    // fichiers qui posent chacun un mot de passe au rôle etl se marcheraient
    // dessus, et l'échec serait intermittent, donc long à diagnostiquer.
    fileParallelism: false
  }
})
