import { describe, expect, it } from 'vitest'
import { creerLimiteur, FENETRE_MS } from '../../../server/utils/limiteTentatives'

describe('limiteTentatives', () => {
  it('refuse la sixième tentative échouée depuis la même adresse', () => {
    const limiteur = creerLimiteur()

    for (let essai = 0; essai < 5; essai++) {
      expect(limiteur.verifier(['ip:203.0.113.7']).autorise).toBe(true)
      limiteur.enregistrerEchec(['ip:203.0.113.7'])
    }

    expect(limiteur.verifier(['ip:203.0.113.7']).autorise).toBe(false)
  })

  it('oublie les tentatives une fois la fenêtre écoulée', () => {
    let instant = 0
    const limiteur = creerLimiteur({ maintenant: () => instant })

    for (let essai = 0; essai < 5; essai++) {
      limiteur.enregistrerEchec(['ip:203.0.113.7'])
    }
    expect(limiteur.verifier(['ip:203.0.113.7']).autorise).toBe(false)

    instant += FENETRE_MS
    expect(limiteur.verifier(['ip:203.0.113.7']).autorise).toBe(true)
  })

  it('dit dans combien de secondes réessayer, à la seconde supérieure', () => {
    let instant = 0
    const limiteur = creerLimiteur({ maintenant: () => instant })

    for (let essai = 0; essai < 5; essai++) {
      limiteur.enregistrerEchec(['ip:203.0.113.7'])
    }

    // Une minute après le premier échec : il reste quatorze minutes avant que
    // la plus ancienne tentative ne sorte de la fenêtre.
    instant += 60_000
    expect(limiteur.verifier(['ip:203.0.113.7']).retryAfterSecondes).toBe(14 * 60)
  })

  it('bloque le compte visé même depuis une adresse neuve', () => {
    const limiteur = creerLimiteur()

    // Cinq adresses différentes s'acharnent sur le même compte : la limite par
    // IP ne voit qu'une tentative chacune, seule la clé de compte les compte.
    for (let essai = 0; essai < 5; essai++) {
      limiteur.enregistrerEchec([`ip:198.51.100.${essai}`, 'compte:cible@enervision.local'])
    }

    const verdict = limiteur.verifier(['ip:203.0.113.7', 'compte:cible@enervision.local'])
    expect(verdict.autorise).toBe(false)
  })

  it('laisse passer un couple adresse et compte étranger au blocage', () => {
    const limiteur = creerLimiteur()

    for (let essai = 0; essai < 5; essai++) {
      limiteur.enregistrerEchec(['ip:203.0.113.7', 'compte:cible@enervision.local'])
    }

    const verdict = limiteur.verifier(['ip:198.51.100.4', 'compte:autre@enervision.local'])
    expect(verdict.autorise).toBe(true)
  })

  it('efface les échecs quand la connexion finit par réussir', () => {
    const limiteur = creerLimiteur()
    const cles = ['ip:203.0.113.7', 'compte:cible@enervision.local']

    // Quatre fautes de frappe, puis le bon mot de passe : l'utilisateur ne doit
    // pas rester à une erreur du verrouillage.
    for (let essai = 0; essai < 4; essai++) {
      limiteur.enregistrerEchec(cles)
    }
    limiteur.reinitialiser(cles)

    for (let essai = 0; essai < 4; essai++) {
      limiteur.enregistrerEchec(cles)
    }
    expect(limiteur.verifier(cles).autorise).toBe(true)
  })
})
