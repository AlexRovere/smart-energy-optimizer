// Les critères de #29 sont des promesses HTTP : un code de retour, un cookie et
// ses attributs, un rejeu refusé. Les vérifier ailleurs qu'en HTTP reviendrait
// à tester autre chose que ce qui est promis, d'où ce fichier de bout en bout.
//
// L'ORDRE des cas compte, et ce n'est pas un accident : la limitation par
// adresse est partagée par tout le fichier, puisque tout part de la même
// adresse de bouclage. Le cas qui épuise le quota vient donc en dernier, et la
// connexion réussie, qui remet les compteurs à zéro, avant lui.
import { fileURLToPath } from 'node:url'
import { hash } from '@node-rs/argon2'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import { PARAMETRES_ARGON2ID } from '../../server/database/seed'
import { creerBaseDeTest, type BaseDeTest } from '../database/base-de-test'

const EMAIL = 'admin@enervision.local'
const MOT_DE_PASSE = 'mot-de-passe-de-demonstration'

let base: BaseDeTest

// Enregistré AVANT celui que `setup` pose : les crochets partent dans l'ordre
// de déclaration, et le serveur Nuxt doit démarrer avec l'URL de base déjà en
// environnement.
beforeAll(async () => {
  base = await creerBaseDeTest()
  process.env.NUXT_DATABASE_URL = base.url
  process.env.NUXT_SESSION_PASSWORD = 'mot-de-passe-de-test-de-trente-deux-signes'

  const empreinte = await hash(MOT_DE_PASSE, PARAMETRES_ARGON2ID)
  await base.sql`INSERT INTO roles (name) VALUES ('ADMIN')`
  await base.sql`
    INSERT INTO users (role_id, email, password_hash)
    SELECT r.id, ${EMAIL}, ${empreinte} FROM roles r WHERE r.name = 'ADMIN'
  `
}, 120_000)

function cookieDe(reponse: Response): string {
  const entete = reponse.headers.get('set-cookie')
  if (entete === null) throw new Error("La réponse ne pose aucun cookie.")
  const [paire] = entete.split(';')
  if (paire === undefined) throw new Error('Cookie illisible.')
  return paire
}

async function seConnecter(email: string, password: string): Promise<Response> {
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
}

describe('authentification', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    browser: false
  })

  it('refuse une route protégée sans session', async () => {
    const reponse = await fetch('/api/auth/session')

    expect(reponse.status).toBe(401)
  })

  it('refuse une entrée qui ne respecte pas le contrat', async () => {
    const reponse = await seConnecter('pas-une-adresse', 'court')

    expect(reponse.status).toBe(422)
  })

  it('refuse un mot de passe faux sans dire ce qui cloche', async () => {
    const reponse = await seConnecter(EMAIL, 'ce-n-est-pas-le-bon')

    expect(reponse.status).toBe(401)
    const corps = await reponse.json()
    expect(JSON.stringify(corps)).not.toContain('mot de passe')
    expect(corps.statusCode).toBe(401)
  })

  it('pose un cookie HttpOnly, Secure et SameSite, sans rendre de jeton', async () => {
    const reponse = await seConnecter(EMAIL, MOT_DE_PASSE)
    expect(reponse.status).toBe(200)

    const entete = reponse.headers.get('set-cookie') ?? ''
    expect(entete).toMatch(/HttpOnly/i)
    expect(entete).toMatch(/Secure/i)
    expect(entete).toMatch(/SameSite/i)

    // Le corps ne porte pas de jeton : le navigateur n'a que le cookie, et
    // rien ne transite par une barre d'adresse.
    expect(await reponse.json()).toEqual({ success: true })
  })

  it('rend le compte et son rôle une fois la session ouverte', async () => {
    const connexion = await seConnecter(EMAIL, MOT_DE_PASSE)
    const cookie = cookieDe(connexion)

    const reponse = await fetch('/api/auth/session', { headers: { cookie } })

    expect(reponse.status).toBe(200)
    const { user } = await reponse.json()
    expect(user.email).toBe(EMAIL)
    expect(user.role).toBe('ADMIN')
  })

  it('refuse un cookie rejoué après déconnexion, alors qu\'il n\'a pas expiré', async () => {
    const connexion = await seConnecter(EMAIL, MOT_DE_PASSE)
    const cookie = cookieDe(connexion)
    expect((await fetch('/api/auth/session', { headers: { cookie } })).status).toBe(200)

    const deconnexion = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { cookie }
    })
    expect(deconnexion.status).toBe(200)

    // Le même cookie, rejoué tel quel : c'est le critère ASVS V3.3.1 et la
    // faiblesse CWE-613. Un cookie scellé seul répondrait encore 200 ici.
    const rejeu = await fetch('/api/auth/session', { headers: { cookie } })
    expect(rejeu.status).toBe(401)
  })

  it('limite les tentatives et dit quand réessayer', async () => {
    for (let essai = 0; essai < 5; essai++) {
      expect((await seConnecter(EMAIL, 'toujours-faux')).status).toBe(401)
    }

    const reponse = await seConnecter(EMAIL, 'toujours-faux')

    expect(reponse.status).toBe(429)
    expect(Number(reponse.headers.get('retry-after'))).toBeGreaterThan(0)
  })
})
