import { describe, expect, it } from 'vitest'
import { MAX_RANGE_DAYS, customRange, rangeError } from '../../app/utils/historyRange'

describe('customRange', () => {
  it('couvre les journées choisies en entier, fin comprise', () => {
    const range = customRange('2026-09-01', '2026-09-15')

    expect(range.from).toBe(new Date(2026, 8, 1).toISOString())
    expect(range.to).toBe(new Date(2026, 8, 16).toISOString())
  })
})

describe('rangeError', () => {
  it('accepte une plage ordinaire', () => {
    expect(rangeError('2026-09-01', '2026-09-15')).toBeNull()
  })

  it('accepte une seule journée', () => {
    expect(rangeError('2026-09-01', '2026-09-01')).toBeNull()
  })

  it('refuse une fin avant le début', () => {
    expect(rangeError('2026-09-15', '2026-09-01')).toBe('La fin de la plage doit suivre son début')
  })

  it(`refuse une plage de plus de ${MAX_RANGE_DAYS} jours, comme la route`, () => {
    expect(rangeError('2026-06-01', '2026-09-01')).toBe(`Plage trop longue : ${MAX_RANGE_DAYS} jours au plus`)
    expect(rangeError('2026-06-01', '2026-08-31')).toBeNull()
  })

  it('demande les deux dates', () => {
    expect(rangeError('', '2026-09-01')).toBe('Choisir une date de début et une date de fin')
  })
})
