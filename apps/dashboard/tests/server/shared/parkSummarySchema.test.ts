import { describe, it, expect } from 'vitest'
import { parkSummarySchema } from '../../../shared/parkSummarySchema'

const summaryValide = {
  timestamp: '2026-09-16T14:32:00Z',
  total_sites: 7,
  excluded_sites: ['SITE004'],
  total_consumption_kw: 1842.30,
  total_capacity_kw: 4130,
  average_load_percent: 44.6,
  sites: [
    {
      site_id: 'SITE001',
      site_name: 'Bureau Paris La Défense',
      current_consumption_kw: 87.34,
      capacity_kw: 200,
      load_percent: 43.7,
      data_quality: 'good' as const
    }
  ]
}

describe('parkSummarySchema', () => {
  it('valide une réponse complète', () => {
    expect(parkSummarySchema.safeParse(summaryValide).success).toBe(true)
  })

  it('accepte total_consumption_kw à null', () => {
    const avecNull = { ...summaryValide, total_consumption_kw: null }
    expect(parkSummarySchema.safeParse(avecNull).success).toBe(true)
  })

  it('accepte excluded_sites vide', () => {
    const sansExclus = { ...summaryValide, excluded_sites: [] }
    expect(parkSummarySchema.safeParse(sansExclus).success).toBe(true)
  })

  it('accepte load_percent à null sur un site', () => {
    const avecNull = {
      ...summaryValide,
      sites: [{ ...summaryValide.sites[0], load_percent: null }]
    }
    expect(parkSummarySchema.safeParse(avecNull).success).toBe(true)
  })

  it('rejette un champ data_quality inconnu', () => {
    const invalide = {
      ...summaryValide,
      sites: [{ ...summaryValide.sites[0], data_quality: 'excellent' }]
    }
    expect(parkSummarySchema.safeParse(invalide).success).toBe(false)
  })

  it('rejette un timestamp non ISO 8601', () => {
    const invalide = { ...summaryValide, timestamp: '16-09-2026' }
    expect(parkSummarySchema.safeParse(invalide).success).toBe(false)
  })

  it('rejette total_sites non entier', () => {
    const invalide = { ...summaryValide, total_sites: 7.5 }
    expect(parkSummarySchema.safeParse(invalide).success).toBe(false)
  })
})
