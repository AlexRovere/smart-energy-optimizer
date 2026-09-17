import { describe, expect, it } from 'vitest'
import { createRateLimiter, WINDOW_MS } from '../../../server/utils/rateLimit'

describe('rateLimit', () => {
  it('refuse la sixième tentative échouée depuis la même adresse', () => {
    const limiter = createRateLimiter()

    for (let attempt = 0; attempt < 5; attempt++) {
      expect(limiter.check(['ip:203.0.113.7']).allowed).toBe(true)
      limiter.recordFailure(['ip:203.0.113.7'])
    }

    expect(limiter.check(['ip:203.0.113.7']).allowed).toBe(false)
  })

  it('oublie les tentatives une fois la fenêtre écoulée', () => {
    let clock = 0
    const limiter = createRateLimiter({ now: () => clock })

    for (let attempt = 0; attempt < 5; attempt++) {
      limiter.recordFailure(['ip:203.0.113.7'])
    }
    expect(limiter.check(['ip:203.0.113.7']).allowed).toBe(false)

    clock += WINDOW_MS
    expect(limiter.check(['ip:203.0.113.7']).allowed).toBe(true)
  })

  it('dit dans combien de secondes réessayer, à la seconde supérieure', () => {
    let clock = 0
    const limiter = createRateLimiter({ now: () => clock })

    for (let attempt = 0; attempt < 5; attempt++) {
      limiter.recordFailure(['ip:203.0.113.7'])
    }

    // Une minute après le premier échec : il reste quatorze minutes avant que
    // la plus ancienne tentative ne sorte de la fenêtre.
    clock += 60_000
    expect(limiter.check(['ip:203.0.113.7']).retryAfterSeconds).toBe(14 * 60)
  })

  it('bloque le compte visé même depuis une adresse neuve', () => {
    const limiter = createRateLimiter()

    // Cinq adresses différentes s'acharnent sur le même compte : la limite par
    // IP ne voit qu'une tentative chacune, seule la clé de compte les compte.
    for (let attempt = 0; attempt < 5; attempt++) {
      limiter.recordFailure([`ip:198.51.100.${attempt}`, 'account:cible@enervision.local'])
    }

    const verdict = limiter.check(['ip:203.0.113.7', 'account:cible@enervision.local'])
    expect(verdict.allowed).toBe(false)
  })

  it('laisse passer un couple adresse et compte étranger au blocage', () => {
    const limiter = createRateLimiter()

    for (let attempt = 0; attempt < 5; attempt++) {
      limiter.recordFailure(['ip:203.0.113.7', 'account:cible@enervision.local'])
    }

    const verdict = limiter.check(['ip:198.51.100.4', 'account:autre@enervision.local'])
    expect(verdict.allowed).toBe(true)
  })

  it('efface les échecs quand la connexion finit par réussir', () => {
    const limiter = createRateLimiter()
    const keys = ['ip:203.0.113.7', 'account:cible@enervision.local']

    // Quatre fautes de frappe, puis le bon mot de passe : l'utilisateur ne doit
    // pas rester à une erreur du verrouillage.
    for (let attempt = 0; attempt < 4; attempt++) {
      limiter.recordFailure(keys)
    }
    limiter.reset(keys)

    for (let attempt = 0; attempt < 4; attempt++) {
      limiter.recordFailure(keys)
    }
    expect(limiter.check(keys).allowed).toBe(true)
  })
})
