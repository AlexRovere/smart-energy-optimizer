import { describe, expect, it } from 'vitest'
import { hoursInHorizon } from '../../../server/utils/predictionHorizon'

describe('hoursInHorizon', () => {
  it('rend une heure par heure de l\'horizon, à partir de l\'heure suivant la référence', () => {
    const reference = new Date('2026-09-18T10:00:00Z')

    expect(hoursInHorizon(reference, 3)).toEqual([
      new Date('2026-09-18T11:00:00Z'),
      new Date('2026-09-18T12:00:00Z'),
      new Date('2026-09-18T13:00:00Z')
    ])
  })

  it('rend un tableau vide pour un horizon nul', () => {
    expect(hoursInHorizon(new Date('2026-09-18T10:00:00Z'), 0)).toEqual([])
  })

  it("part de l'heure pleine suivante : une prévision est horaire, son échéance aussi", () => {
    const reference = new Date('2026-09-18T10:41:52.609Z')

    expect(hoursInHorizon(reference, 2)).toEqual([
      new Date('2026-09-18T11:00:00Z'),
      new Date('2026-09-18T12:00:00Z')
    ])
  })
})
