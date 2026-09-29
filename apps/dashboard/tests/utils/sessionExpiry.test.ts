import { describe, expect, it } from 'vitest'
import { expiredSessionRedirect, safeReturnPath } from '../../app/utils/sessionExpiry'

describe('expiredSessionRedirect', () => {
  it('renvoie vers la connexion avec le message et la page à retrouver', () => {
    expect(expiredSessionRedirect('/api/sites/SITE001/current', 401, true, '/sites/SITE001?w=7j'))
      .toBe('/login?expired=1&redirect=%2Fsites%2FSITE001%3Fw%3D7j')
  })

  it("ignore une réponse qui n'est pas un 401", () => {
    expect(expiredSessionRedirect('/api/sites', 503, true, '/')).toBeNull()
  })

  it("ignore un 401 quand personne n'était connecté", () => {
    expect(expiredSessionRedirect('/api/sites', 401, false, '/')).toBeNull()
  })

  it.each(['/api/auth/login', '/api/auth/session'])(
    "laisse %s gérer lui-même son 401 (mauvais mot de passe, visiteur anonyme)",
    (url) => {
      expect(expiredSessionRedirect(url, 401, true, '/')).toBeNull()
    },
  )

  it("ignore un 401 d'un service hors de /api", () => {
    expect(expiredSessionRedirect('https://ailleurs.example/api/x', 401, true, '/')).toBeNull()
  })

  it("ne propose pas de revenir sur la page de connexion", () => {
    expect(expiredSessionRedirect('/api/sites', 401, true, '/login')).toBe('/login?expired=1')
  })
})

describe('safeReturnPath', () => {
  it('garde un chemin interne', () => {
    expect(safeReturnPath('/sites/SITE001?w=7j')).toBe('/sites/SITE001?w=7j')
  })

  it.each([
    ['une adresse externe', 'https://ailleurs.example'],
    ['une adresse sans protocole', '//ailleurs.example'],
    ['un antislash détourné', '/\\ailleurs.example'],
    ['un chemin relatif', 'sites'],
    ['une absence', undefined],
    ['une liste', ['/a', '/b']],
  ])('refuse %s et revient à la vue d\'ensemble', (_case, value) => {
    expect(safeReturnPath(value)).toBe('/')
  })
})
