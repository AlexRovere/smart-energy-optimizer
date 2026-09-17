import { describe, expect, it } from 'vitest'
import { exigeUnConteneur } from './global-setup'

// Sans conteneur joignable, les tests de base s'ignorent sur un poste et
// échouent en intégration continue. Cette fonction est le seul endroit qui
// tranche, donc le seul à tester : le reste est du câblage.
describe("exigence d'un conteneur de base", () => {
  it("l'exige en intégration continue", () => {
    expect(exigeUnConteneur({ CI: 'true' })).toBe(true)
  })

  it("l'exige quelle que soit la façon dont la CI marque sa présence", () => {
    expect(exigeUnConteneur({ CI: '1' })).toBe(true)
    expect(exigeUnConteneur({ CI: 'yes' })).toBe(true)
  })

  it("ne l'exige pas sur un poste", () => {
    expect(exigeUnConteneur({})).toBe(false)
  })

  it("ne l'exige pas quand la variable existe sans rien affirmer", () => {
    expect(exigeUnConteneur({ CI: '' })).toBe(false)
    expect(exigeUnConteneur({ CI: 'false' })).toBe(false)
    expect(exigeUnConteneur({ CI: '0' })).toBe(false)
  })
})
