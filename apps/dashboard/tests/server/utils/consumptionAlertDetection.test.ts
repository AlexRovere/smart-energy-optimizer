import { describe, expect, it } from 'vitest'
import { detectConsumptionAlert } from '../../../server/utils/consumptionAlertDetection'

const REFERENCE = new Date('2026-09-18T10:00:00Z')
const RÉGLAGE = { duration: 3, threshold: 200 }

// Trois heures de consommation en kWh, se terminant à REFERENCE.
function fenêtre(valeurs: [number, number, number]) {
  return [
    { timestamp: '2026-09-18T08:00:00Z', value: valeurs[0] },
    { timestamp: '2026-09-18T09:00:00Z', value: valeurs[1] },
    { timestamp: '2026-09-18T10:00:00Z', value: valeurs[2] }
  ]
}

describe('detectConsumptionAlert', () => {
  it('déclenche quand la moyenne glissante dépasse le seuil, et rend la moyenne et le seuil', () => {
    // Moyenne : 230
    expect(detectConsumptionAlert(fenêtre([210, 220, 260]), REFERENCE, RÉGLAGE)).toEqual({
      alert: true,
      average: 230,
      thresholdKwh: 200
    })
  })

  it('ne déclenche pas quand la moyenne glissante reste sous le seuil', () => {
    // Moyenne : 180
    expect(detectConsumptionAlert(fenêtre([170, 180, 190]), REFERENCE, RÉGLAGE)).toEqual({
      alert: false,
      average: 180,
      thresholdKwh: 200
    })
  })

  it('déclenche à la limite exacte du seuil, "atteint ou dépasse"', () => {
    // Moyenne : exactement 200
    expect(detectConsumptionAlert(fenêtre([180, 200, 220]), REFERENCE, RÉGLAGE).alert).toBe(true)
  })

  it('ne déclenche pas quand aucune donnée ne tombe dans la fenêtre, moyenne nulle', () => {
    const valeurs = [{ timestamp: '2026-01-01T00:00:00Z', value: 999 }]

    expect(detectConsumptionAlert(valeurs, REFERENCE, RÉGLAGE)).toEqual({
      alert: false,
      average: null,
      thresholdKwh: 200
    })
  })
})
