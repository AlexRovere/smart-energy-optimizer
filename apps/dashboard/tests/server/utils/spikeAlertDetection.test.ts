import { describe, expect, it } from 'vitest'
import { detectSpikeAlert } from '../../../server/utils/spikeAlertDetection'

const REFERENCE = new Date('2026-09-18T10:00:00Z')
const RÉGLAGE = { duration: 4, threshold: 1.5 }

// Trois heures précédant REFERENCE, moyenne = 200.
const PRÉCÉDENTES = [
  { timestamp: '2026-09-18T07:00:00Z', value: 180 },
  { timestamp: '2026-09-18T08:00:00Z', value: 200 },
  { timestamp: '2026-09-18T09:00:00Z', value: 220 }
]

describe('detectSpikeAlert', () => {
  it('déclenche quand la valeur courante dépasse la moyenne × threshold, et rend la moyenne et le seuil en kW', () => {
    // 200 × 1.5 = 300
    expect(detectSpikeAlert(PRÉCÉDENTES, REFERENCE, 310, RÉGLAGE)).toEqual({
      alert: true,
      currentValue: 310,
      average: 200,
      thresholdKw: 300
    })
  })

  it('ne déclenche pas quand la valeur courante reste sous la moyenne × threshold', () => {
    expect(detectSpikeAlert(PRÉCÉDENTES, REFERENCE, 250, RÉGLAGE)).toEqual({
      alert: false,
      currentValue: 250,
      average: 200,
      thresholdKw: 300
    })
  })

  it('déclenche à la limite exacte, "atteint ou dépasse"', () => {
    expect(detectSpikeAlert(PRÉCÉDENTES, REFERENCE, 300, RÉGLAGE).alert).toBe(true)
  })

  it('ne déclenche pas quand aucune moyenne ne peut être calculée', () => {
    const aucune: typeof PRÉCÉDENTES = []

    expect(detectSpikeAlert(aucune, REFERENCE, 9999, RÉGLAGE)).toEqual({
      alert: false,
      currentValue: 9999,
      average: null,
      thresholdKw: null
    })
  })
})
