import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, DOSSIER_MIGRATIONS, type BaseDeTest } from './base-de-test'
import { amorcer, COMPTES_DE_DEMONSTRATION, ROLES } from '../../server/database/seed'

const OPTIONS = {
  motDePasseDemonstration: 'mot-de-passe-de-test',
  motDePasseEtl: 'mot-de-passe-etl-de-test'
}

// Apostrophe, antislash et guillemet : de quoi casser une concaténation naïve.
// ALTER ROLE ... PASSWORD n'accepte aucun paramètre lié, donc l'amorçage
// assemble là le seul SQL non paramétré de la branche, et rien ne l'exerçait
// jusqu'ici avec autre chose qu'un mot de passe sage.
const MOT_DE_PASSE_ETL_HOSTILE = 'a\'b\\c"d'

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

  it("n'écrase pas un mot de passe changé depuis", async () => {
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

  it("n'amorce aucun site : le référentiel appartient à l'ETL", async () => {
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

  // Volontairement le dernier test qui amorce : le mot de passe d'un rôle est
  // global au cluster, celui-ci le remplace pour de bon. Il couvre d'un coup
  // l'échappement par quote_literal et la propriété que personne ne vérifiait,
  // le mot de passe posé par l'amorçage ouvrant réellement une session.
  it('pose un mot de passe hostile avec lequel le rôle etl se connecte vraiment', async () => {
    await amorcer(base.sql, { ...OPTIONS, motDePasseEtl: MOT_DE_PASSE_ETL_HOSTILE })

    // Connexion par options et non par URL : un mot de passe pareil ne traverse
    // pas une chaîne d'URL sans questions d'encodage, et ce test parle
    // d'échappement SQL, pas d'encodage d'URL.
    const url = new URL(base.url)
    const etl = postgres({
      host: url.hostname,
      port: Number(url.port),
      database: url.pathname.slice(1),
      username: 'etl',
      password: MOT_DE_PASSE_ETL_HOSTILE,
      max: 1
    })

    try {
      const [ligne] = await etl<{ utilisateur: string }[]>`
        SELECT current_user AS utilisateur
      `
      expect(ligne.utilisateur).toBe('etl')
      expect(await etl`SELECT id FROM sites`).toHaveLength(0)
    } finally {
      await etl.end()
    }
  })

  it("s'arrête dès la première insertion si les migrations n'ont pas été appliquées", async () => {
    const vierge = await creerBaseDeTest({ migrer: false })
    try {
      const erreur = await amorcer(vierge.sql, OPTIONS).catch((cause: unknown) => cause)

      // Ce que l'échec dit réellement : 42P01, table roles inexistante. C'est
      // PostgreSQL qui parle, pas la garde de seed.ts, qu'une base vierge
      // n'atteint jamais. L'assertion le nomme plutôt que de se contenter d'un
      // rejet quelconque ; la garde est couverte juste en dessous.
      expect(erreur).toMatchObject({ code: '42P01' })
      expect((erreur as Error).message).toMatch(/relation "roles" does not exist/)
    } finally {
      await vierge.fermer()
    }
  })

  describe('la garde du rôle etl, là où elle est atteignable', () => {
    // Un rôle PostgreSQL est global au cluster, et le conteneur partagé de la
    // suite en a déjà un : la garde de seed.ts y est inatteignable, quelle que
    // soit la base. Un second conteneur, jetable, est le seul endroit où le
    // schéma peut exister sans le rôle. On y applique les migrations, puis on
    // retire le rôle : c'est exactement la situation que la conception nomme,
    // une base dont les migrations ne sont pas celles qu'on croit.
    let conteneur: StartedPostgreSqlContainer
    let sql: postgres.Sql

    beforeAll(async () => {
      conteneur = await new PostgreSqlContainer('postgres:16-alpine').start()
      sql = postgres(conteneur.getConnectionUri(), { max: 1 })
      await migrate(drizzle(sql), { migrationsFolder: DOSSIER_MIGRATIONS })
      // DROP OWNED BY retire aussi les privilèges accordés au rôle dans cette
      // base : sans lui, la suppression bute sur la table sites.
      await sql.unsafe('DROP OWNED BY etl')
      await sql.unsafe('DROP ROLE etl')
    })

    afterAll(async () => {
      await sql?.end()
      await conteneur?.stop()
    })

    it('nomme le rôle manquant au lieu de laisser PostgreSQL parler à sa place', async () => {
      await expect(amorcer(sql, OPTIONS)).rejects.toThrow(
        "Le rôle PostgreSQL « etl » n'existe pas : appliquer les migrations avant d'amorcer."
      )
    })
  })
})
