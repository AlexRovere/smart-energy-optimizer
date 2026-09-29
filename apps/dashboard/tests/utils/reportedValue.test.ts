import { describe, expect, it } from 'vitest'
import { displayedConsumption } from '../../app/utils/reportedValue'

const history = [
  { timestamp: '2026-09-29T11:00:00Z', consumption_kw: 100, consumption_kw_corrected: 100 },
  { timestamp: '2026-09-29T12:00:00Z', consumption_kw: null, consumption_kw_corrected: 104 },
  { timestamp: '2026-09-29T13:00:00Z', consumption_kw: null, consumption_kw_corrected: null },
]

describe('displayedConsumption', () => {
  it('affiche la mesure courante quand elle existe', () => {
    expect(displayedConsumption({ consumption_kw: 120 }, history)).toEqual({ kw: 120, reportedAt: null })
  })

  it("reporte la dernière valeur connue de l'historique, corrigée par l'ETL, quand la mesure manque", () => {
    expect(displayedConsumption({ consumption_kw: null }, history))
      .toEqual({ kw: 104, reportedAt: '2026-09-29T12:00:00Z' })
  })

  it('reporte aussi quand la mesure courante est indisponible', () => {
    expect(displayedConsumption(null, history)).toEqual({ kw: 104, reportedAt: '2026-09-29T12:00:00Z' })
  })

  it("n'invente rien quand l'historique n'a aucune valeur", () => {
    expect(displayedConsumption({ consumption_kw: null }, [])).toBeNull()
  })
})
