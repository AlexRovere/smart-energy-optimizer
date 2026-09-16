import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, type BaseDeTest } from './base-de-test'
import { amorcer, COMPTES_DE_DEMONSTRATION, ROLES } from '../../server/database/seed'

const OPTIONS = {
  motDePasseDemonstration: 'mot-de-passe-de-test',
  motDePasseEtl: 'mot-de-passe-etl-de-test'
}

describe('amorçage', () => {
  let base: BaseDeTest

  beforeAll(async () => {
    base = await creerBaseDeTest()
  })

  afterAll(async () => {
    await base?.fermer()
  })

  const compter = async (table: 'roles' | 'users') => {
    const [{ total }] = await base.sql<{ total: number }[]>`
      SELECT count(*)::int AS total FROM ${base.sql(table)}
    `
    return total
  }

  it('crée les trois rôles et les trois comptes au premier passage', async () => {
    const resultat = await amorcer(base.sql, OPTIONS)

    expect(resultat).toEqual({ rolesCrees: 3, comptesCrees: 3 })
    expect(await compter('roles')).toBe(ROLES.length)
    expect(await compter('users')).toBe(COMPTES_DE_DEMONSTRATION.length)
  })

  it('hache les mots de passe en Argon2id', async () => {
    const [ligne] = await base.sql<{ password_hash: string }[]>`
      SELECT password_hash FROM users WHERE email = ${COMPTES_DE_DEMONSTRATION[0].email}
    `
    expect(ligne.password_hash).toMatch(/^\$argon2id\$/)
    expect(ligne.password_hash).toContain('m=19456,t=2,p=1')
  })

  it('ne duplique rien au second passage', async () => {
    const resultat = await amorcer(base.sql, OPTIONS)

    expect(resultat).toEqual({ rolesCrees: 0, comptesCrees: 0 })
    expect(await compter('roles')).toBe(ROLES.length)
    expect(await compter('users')).toBe(COMPTES_DE_DEMONSTRATION.length)
  })

  it('n écrase pas un mot de passe changé depuis', async () => {
    const email = COMPTES_DE_DEMONSTRATION[0].email
    const empreinteChangee = '$argon2id$empreinte-posee-a-la-main'

    await base.sql`
      UPDATE users SET password_hash = ${empreinteChangee} WHERE email = ${email}
    `
    await amorcer(base.sql, OPTIONS)

    const [ligne] = await base.sql<{ password_hash: string }[]>`
      SELECT password_hash FROM users WHERE email = ${email}
    `
    expect(ligne.password_hash).toBe(empreinteChangee)
  })

  it('n amorce aucun site : le référentiel appartient à l ETL', async () => {
    const [{ total }] = await base.sql<{ total: number }[]>`
      SELECT count(*)::int AS total FROM sites
    `
    expect(total).toBe(0)
  })

  it('rend le rôle etl capable de se connecter', async () => {
    const [ligne] = await base.sql<{ rolcanlogin: boolean }[]>`
      SELECT rolcanlogin FROM pg_roles WHERE rolname = 'etl'
    `
    expect(ligne.rolcanlogin).toBe(true)
  })

  it('s arrête clairement si les migrations n ont pas été appliquées', async () => {
    const vierge = await creerBaseDeTest({ migrer: false })
    try {
      await expect(amorcer(vierge.sql, OPTIONS)).rejects.toThrow()
    } finally {
      await vierge.fermer()
    }
  })
})
