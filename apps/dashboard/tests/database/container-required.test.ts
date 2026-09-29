import { describe, expect, it } from 'vitest'
import { requiresContainer } from './global-setup'

// Sans conteneur joignable, les tests de base s'ignorent sur un poste et
// échouent en intégration continue. Cette fonction est le seul endroit qui
// tranche, donc le seul à tester : le reste est du câblage.
describe("exigence d'un conteneur de base", () => {
  it("l'exige en intégration continue", () => {
    expect(requiresContainer({ CI: 'true' })).toBe(true)
  })

  it("l'exige quelle que soit la façon dont la CI marque sa présence", () => {
    expect(requiresContainer({ CI: '1' })).toBe(true)
    expect(requiresContainer({ CI: 'yes' })).toBe(true)
  })

  it("ne l'exige pas sur un poste", () => {
    expect(requiresContainer({})).toBe(false)
  })

  it("ne l'exige pas quand la variable existe sans rien affirmer", () => {
    expect(requiresContainer({ CI: '' })).toBe(false)
    expect(requiresContainer({ CI: 'false' })).toBe(false)
    expect(requiresContainer({ CI: '0' })).toBe(false)
  })
})
