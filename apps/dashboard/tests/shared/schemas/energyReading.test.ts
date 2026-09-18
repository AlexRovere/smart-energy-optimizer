import { describe, expect, it } from 'vitest'
import { energyReadingSchema } from '../../../shared/energyReadingSchema'

const VALID_READING = {
  timestamp: '2026-09-16T14:00:00Z',
  site_id: 'SITE001',
  site_type: 'office',
  consumption_kw: 87.34,
  consumption_kwh: 87.34,
  voltage_v: 401.2,
  current_a: 125.8,
  power_factor: 0.94,
  temperature_celsius: 18.6,
  humidity_percent: 62.0,
  null_reasons: [],
  data_quality: 'good',
}

describe('energyReadingSchema', () => {
  it('accepte un objet conforme à api.md §6', () => {
    const result = energyReadingSchema.safeParse(VALID_READING)
    expect(result.success).toBe(true)
  })

  it('retourne les valeurs parsées à l\'identique', () => {
    const result = energyReadingSchema.safeParse(VALID_READING)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.site_id).toBe('SITE001')
    expect(result.data.consumption_kw).toBe(87.34)
    expect(result.data.data_quality).toBe('good')
  })

  it.each([
    'consumption_kw',
    'consumption_kwh',
    'voltage_v',
    'current_a',
    'power_factor',
    'temperature_celsius',
    'humidity_percent',
  ] as const)('accepte null pour le champ nullable %s', (field) => {
    const result = energyReadingSchema.safeParse({ ...VALID_READING, [field]: null })
    expect(result.success).toBe(true)
  })

  it('accepte null_reasons vide', () => {
    const result = energyReadingSchema.safeParse({ ...VALID_READING, null_reasons: [] })
    expect(result.success).toBe(true)
  })

  it('accepte null_reasons avec plusieurs raisons', () => {
    const result = energyReadingSchema.safeParse({
      ...VALID_READING,
      null_reasons: ['consumption_sensor_offline', 'electrical_sensor_offline'],
    })
    expect(result.success).toBe(true)
  })

  it.each(['good', 'partial', 'degraded', 'critical'] as const)(
    'accepte data_quality "%s"',
    (quality) => {
      const result = energyReadingSchema.safeParse({ ...VALID_READING, data_quality: quality })
      expect(result.success).toBe(true)
    },
  )

  it('rejette data_quality invalide', () => {
    const result = energyReadingSchema.safeParse({ ...VALID_READING, data_quality: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('rejette un objet auquel il manque timestamp', () => {
    const { timestamp: _, ...without } = VALID_READING
    const result = energyReadingSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('accepte un objet sans null_reasons et normalise vers []', () => {
    const { null_reasons: _, ...without } = VALID_READING
    const result = energyReadingSchema.safeParse(without)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.null_reasons).toEqual([])
    }
  })
})
