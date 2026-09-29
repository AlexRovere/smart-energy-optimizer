import { describe, expect, it } from 'vitest'
import { refreshLabel } from '../../app/utils/refresh'

// Heure locale : l'étiquette s'affiche dans le fuseau du navigateur.
const AT_14_32 = new Date(2026, 8, 29, 14, 32, 10).getTime()

describe('refreshLabel', () => {
  it("donne l'heure du dernier rafraîchissement réussi", () => {
    expect(refreshLabel(AT_14_32, false)).toBe('Actualisé à 14:32')
  })

  it("signale un échec en gardant l'heure des dernières données", () => {
    expect(refreshLabel(AT_14_32, true)).toBe("Échec de l'actualisation, données de 14:32")
  })

  it('attend le premier chargement', () => {
    expect(refreshLabel(null, false)).toBe('Chargement…')
  })

  it("signale l'absence de toute donnée", () => {
    expect(refreshLabel(null, true)).toBe('Données indisponibles')
  })
})
