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
    fileParallelism: false,
    // Désactivée par défaut, allumée par `--coverage` en CI. Aucun seuil : la
    // couverture se lit dans SonarCloud, elle ne bloque pas (docs/ci-cd.md).
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts', 'shared/**/*.ts'],
      // Chemins du rapport LCOV relatifs à la racine du dépôt, d'où SonarCloud
      // lance son analyse : relatifs au dashboard, il ne retrouverait aucun fichier.
      reporter: ['text-summary', ['lcovonly', { projectRoot: '../..' }]]
    }
  }
})
