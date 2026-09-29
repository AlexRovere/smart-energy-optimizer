// Un seul conteneur PostgreSQL par projet Vitest : chaque fichier de test crée
// sa propre BASE dedans, ce qui isole sans payer un démarrage de conteneur par
// fichier.
//
// Ce démarrage est TOLÉRANT sur un poste, et seulement là. Vitest exécute une
// amorce globale avant toute collecte de fichiers : si elle lève, la course
// s'arrête et Vitest annonce « No test files found », un message qui parle de
// découverte alors que rien n'a été découvert. Un poste sans runtime de
// conteneurs ne pouvait donc lancer aucun test, pas même ceux qui n'ont jamais
// vu une base.
//
// En intégration continue, au contraire, l'absence de conteneur est une panne :
// laisser les tests de base s'ignorer en silence rendrait la suite verte sans
// qu'elle ait rien vérifié.
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  interface ProvidedContext {
    // Chaîne vide quand aucun conteneur n'a pu démarrer : les fichiers qui ont
    // besoin d'une base s'ignorent alors, au lieu d'échouer.
    adminUrl: string
  }
}

let container: StartedPostgreSqlContainer | undefined

// Seul endroit qui tranche entre « s'ignorer » et « échouer ». Toute valeur
// posée dans CI vaut présence, sauf celles qui nient explicitement : les
// forges ne s'accordent pas sur `true`, `1` ou le nom du fournisseur.
export function requiresContainer(env: NodeJS.ProcessEnv): boolean {
  const ci = env.CI
  if (ci === undefined) return false
  return !['', '0', 'false'].includes(ci.toLowerCase())
}

export async function setup(project: TestProject) {
  try {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()
    project.provide('adminUrl', container.getConnectionUri())
  } catch (cause) {
    if (requiresContainer(process.env)) {
      throw new Error(
        "Aucun runtime de conteneurs joignable, alors que l'intégration continue l'exige : "
        + 'les tests de base ne peuvent pas être ignorés ici.',
        { cause }
      )
    }

    project.provide('adminUrl', '')
    console.warn(
      "\n  Aucun runtime de conteneurs joignable : les tests qui ont besoin d'une base\n"
      + '  sont ignorés. Démarrer Docker pour les exécuter. Le reste de la suite tourne.\n'
    )
  }
}

export async function teardown() {
  await container?.stop()
}
