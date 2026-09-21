import { describe, expect, it } from 'vitest'
import { rollingAverage } from '../../../server/utils/rollingAverage'

const REFERENCE = new Date('2026-09-18T10:00:00Z')

describe('rollingAverage', () => {
  it('moyenne les valeurs des dureeHeures précédant la référence, borne de fin incluse', () => {
    const valeurs = [
      { timestamp: '2026-09-18T06:00:00Z', value: 100 },
      { timestamp: '2026-09-18T07:00:00Z', value: 200 },
      { timestamp: '2026-09-18T08:00:00Z', value: 300 },
      { timestamp: '2026-09-18T09:00:00Z', value: 400 },
      { timestamp: '2026-09-18T10:00:00Z', value: 500 }
    ]

    expect(rollingAverage(valeurs, REFERENCE, 5)).toBe(300)
  })

  it('exclut la borne de début de la fenêtre', () => {
    const valeurs = [
      { timestamp: '2026-09-18T05:00:00Z', value: 1000 },
      { timestamp: '2026-09-18T10:00:00Z', value: 500 }
    ]

    expect(rollingAverage(valeurs, REFERENCE, 5)).toBe(500)
  })

  it('exclut les valeurs postérieures à la référence', () => {
    const valeurs = [
      { timestamp: '2026-09-18T09:00:00Z', value: 200 },
      { timestamp: '2026-09-18T11:00:00Z', value: 9999 }
    ]

    expect(rollingAverage(valeurs, REFERENCE, 5)).toBe(200)
  })

  it('rend null quand aucune valeur ne tombe dans la fenêtre', () => {
    const valeurs = [{ timestamp: '2026-09-10T00:00:00Z', value: 100 }]

    expect(rollingAverage(valeurs, REFERENCE, 5)).toBeNull()
  })

  it('moyenne ce qui est disponible même avec moins de points que la durée', () => {
    const valeurs = [{ timestamp: '2026-09-18T09:00:00Z', value: 150 }]

    expect(rollingAverage(valeurs, REFERENCE, 5)).toBe(150)
  })
})
