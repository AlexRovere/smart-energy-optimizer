// Les critères de #29 sont des promesses HTTP : un code de retour, un cookie et
// ses attributs, un rejeu refusé. Les vérifier ailleurs qu'en HTTP reviendrait
// à tester autre chose que ce qui est promis, d'où ce fichier de bout en bout.
//
// L'ORDRE des cas compte, et ce n'est pas un accident : la limitation par
// adresse est partagée par tout le fichier, puisque tout part de la même
// adresse de bouclage. Le cas qui épuise le quota vient donc en dernier, et la
// signInResponse réussie, qui remet les compteurs à zéro, avant lui.
import { fileURLToPath } from 'node:url'
import { hash } from '@node-rs/argon2'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { beforeAll, describe, expect, it } from 'vitest'
import { PARAMETRES_ARGON2ID } from '../../server/database/seed'
import { creerBaseDeTest, type BaseDeTest } from '../database/base-de-test'

const EMAIL = 'admin@enervision.local'
const PASSWORD = 'mot-de-passe-de-demonstration'

let testDb: BaseDeTest

// Enregistré AVANT celui que `setup` pose : les crochets partent dans l'ordre
// de déclaration, et le serveur Nuxt doit démarrer avec l'URL de base déjà en
// environnement.
beforeAll(async () => {
  testDb = await creerBaseDeTest()
  process.env.NUXT_DATABASE_URL = testDb.url
  process.env.NUXT_SESSION_PASSWORD = 'mot-de-passe-de-test-de-trente-deux-signes'
  // Une source qui refuse la connexion tout de suite : la route de #20 doit
  // échouer vite et de façon prévisible, pas dépendre d'un réseau.
  process.env.NUXT_MOCK_API_URL = 'http://127.0.0.1:1'

  const digest = await hash(PASSWORD, PARAMETRES_ARGON2ID)
  await testDb.sql`INSERT INTO roles (name) VALUES ('ADMIN')`
  await testDb.sql`
    INSERT INTO users (role_id, email, password_hash)
    SELECT r.id, ${EMAIL}, ${digest} FROM roles r WHERE r.name = 'ADMIN'
  `
}, 120_000)

function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie')
  if (header === null) throw new Error("La réponse ne pose aucun cookie.")
  const [pair] = header.split(';')
  if (pair === undefined) throw new Error('Cookie illisible.')
  return pair
}

async function signIn(email: string, password: string): Promise<Response> {
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
    const response = await fetch('/api/auth/session')

    expect(response.status).toBe(401)
  })

  it('renvoie un visiteur sans session vers la page de signInResponse', async () => {
    const response = await fetch('/')

    expect(response.url).toContain('/login')
    expect(await response.text()).toContain('Accès au portail EnerVision')
  })

  it('laisse entrer le porteur d\'une session valide', async () => {
    const signInResponse = await signIn(EMAIL, PASSWORD)
    const cookie = cookieFrom(signInResponse)

    const response = await fetch('/', { headers: { cookie } })

    expect(response.url).not.toContain('/login')
    expect(response.status).toBe(200)
  })

  it('protège aussi les routes de données, pas seulement celles de session', async () => {
    // #20 a livré cette route sans garde, en attendant #29. Sans session elle
    // répond 401 ; avec, elle atteint sa source, injoignable ici, donc 503.
    const anonymous = await fetch('/api/sites/SITE001/current')
    expect(anonymous.status).toBe(401)

    const signInResponse = await signIn(EMAIL, PASSWORD)
    const authenticated = await fetch('/api/sites/SITE001/current', {
      headers: { cookie: cookieFrom(signInResponse) }
    })
    expect(authenticated.status).not.toBe(401)
  })

  it('refuse une entrée qui ne respecte pas le contrat', async () => {
    const response = await signIn('pas-une-adresse', 'court')

    expect(response.status).toBe(422)
  })

  it('refuse un mot de passe faux sans dire ce qui cloche', async () => {
    const response = await signIn(EMAIL, 'ce-n-est-pas-le-bon')

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(JSON.stringify(body)).not.toContain('mot de passe')
    expect(body.statusCode).toBe(401)
  })

  it('pose un cookie HttpOnly, Secure et SameSite, sans rendre de jeton', async () => {
    const response = await signIn(EMAIL, PASSWORD)
    expect(response.status).toBe(200)

    const header = response.headers.get('set-cookie') ?? ''
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toMatch(/Secure/i)
    expect(header).toMatch(/SameSite/i)

    // Le corps ne porte pas de jeton : le navigateur n'a que le cookie, et
    // rien ne transite par une barre d'adresse.
    expect(await response.json()).toEqual({ success: true })
  })

  it('rend le compte et son rôle une fois la session ouverte', async () => {
    const signInResponse = await signIn(EMAIL, PASSWORD)
    const cookie = cookieFrom(signInResponse)

    const response = await fetch('/api/auth/session', { headers: { cookie } })

    expect(response.status).toBe(200)
    const { user } = await response.json()
    expect(user.email).toBe(EMAIL)
    expect(user.role).toBe('ADMIN')
  })

  it('refuse un cookie rejoué après déconnexion, alors qu\'il n\'a pas expiré', async () => {
    const signInResponse = await signIn(EMAIL, PASSWORD)
    const cookie = cookieFrom(signInResponse)
    expect((await fetch('/api/auth/session', { headers: { cookie } })).status).toBe(200)

    const logoutResponse = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { cookie }
    })
    expect(logoutResponse.status).toBe(200)

    // Le même cookie, rejoué tel quel : c'est le critère ASVS V3.3.1 et la
    // faiblesse CWE-613. Un cookie scellé seul répondrait encore 200 ici.
    const replay = await fetch('/api/auth/session', { headers: { cookie } })
    expect(replay.status).toBe(401)
  })

  it('limite les tentatives et dit quand réessayer', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await signIn(EMAIL, 'toujours-faux')).status).toBe(401)
    }

    const response = await signIn(EMAIL, 'toujours-faux')

    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
  })
})
