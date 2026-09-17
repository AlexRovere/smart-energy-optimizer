import { describe, it, expect } from 'vitest'
import { energyReadingSchema } from '../../../shared/energyReadingSchema'

const mesureValide = {
  timestamp: '2026-09-16T14:00:00Z',
  site_id: 'SITE001',
  site_type: 'office',
  consumption_kw: 87.34,
  consumption_kw_raw: 87.10,
  consumption_kwh: 87.34,
  voltage_v: 401.2,
  current_a: 125.8,
  power_factor: 0.94,
  temperature_celsius: 18.6,
  humidity_percent: 62.0,
  null_reasons: [],
  data_quality: 'good' as const
}

describe('energyReadingSchema', () => {
  it('valide une mesure complète', () => {
    expect(energyReadingSchema.safeParse(mesureValide).success).toBe(true)
  })

  it('accepte tous les champs optionnels absents', () => {
    const minimal = {
      timestamp: '2026-09-16T14:00:00Z',
      site_id: 'SITE001',
      consumption_kw: 87.34,
      null_reasons: [],
      data_quality: 'good'
    }
    expect(energyReadingSchema.safeParse(minimal).success).toBe(true)
  })

  it('accepte les champs numériques à null', () => {
    const avecNulls = {
      ...mesureValide,
      voltage_v: null,
      current_a: null,
      power_factor: null,
      temperature_celsius: null,
      humidity_percent: null
    }
    expect(energyReadingSchema.safeParse(avecNulls).success).toBe(true)
  })

  it('rejette une valeur inconnue dans data_quality', () => {
    const invalide = { ...mesureValide, data_quality: 'excellent' }
    expect(energyReadingSchema.safeParse(invalide).success).toBe(false)
  })

  it('rejette un timestamp non ISO 8601', () => {
    const invalide = { ...mesureValide, timestamp: '16/09/2026 14:00' }
    expect(energyReadingSchema.safeParse(invalide).success).toBe(false)
  })

  it('rejette un site_id absent', () => {
    const { site_id: _, ...sansSiteId } = mesureValide
    expect(energyReadingSchema.safeParse(sansSiteId).success).toBe(false)
  })
})
