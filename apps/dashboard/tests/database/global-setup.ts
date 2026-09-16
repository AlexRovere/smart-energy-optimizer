// Un seul conteneur PostgreSQL pour toute la suite : chaque fichier de test
// cree sa propre BASE dedans, ce qui isole sans payer un demarrage de
// conteneur par fichier.
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  interface ProvidedContext {
    urlAdministrateur: string
  }
}

let conteneur: StartedPostgreSqlContainer | undefined

export async function setup(projet: TestProject) {
  conteneur = await new PostgreSqlContainer('postgres:16-alpine').start()
  projet.provide('urlAdministrateur', conteneur.getConnectionUri())
}

export async function teardown() {
  await conteneur?.stop()
}
