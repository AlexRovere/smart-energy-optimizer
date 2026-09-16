import { afterAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, ligneAttendue, type BaseDeTest } from './base-de-test'

describe('socle de test', () => {
  const basesOuvertes: BaseDeTest[] = []

  afterAll(async () => {
    await Promise.all(basesOuvertes.map(base => base.fermer()))
  })

  it('rend une base jetable joignable', async () => {
    const base = await creerBaseDeTest({ migrer: false })
    basesOuvertes.push(base)

    const ligne = ligneAttendue(
      await base.sql<{ un: number }[]>`SELECT 1 AS un`,
      'le SELECT 1 de la base jetable'
    )
    expect(ligne.un).toBe(1)
  })

  it("isole deux bases l'une de l'autre", async () => {
    const premiere = await creerBaseDeTest({ migrer: false })
    const seconde = await creerBaseDeTest({ migrer: false })
    basesOuvertes.push(premiere, seconde)

    await premiere.sql`CREATE TABLE marqueur (id integer)`

    const { existe } = ligneAttendue(
      await seconde.sql<{ existe: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'marqueur'
        ) AS existe
      `,
      'la présence de la table marqueur dans la seconde base'
    )
    expect(existe).toBe(false)
  })
})
