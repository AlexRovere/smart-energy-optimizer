import { describe, expect, it } from 'vitest'
import { qualityHint, qualityLabel, siteStatusLabel, siteTypeLabel } from '../../app/utils/labels'

describe('siteTypeLabel', () => {
  it.each([
    ['office', 'Bureaux'],
    ['factory', 'Usine'],
    ['datacenter', 'Centre de données'],
    ['hospital', 'Hôpital'],
    ['retail', 'Commerce'],
  ])('traduit %s', (type, label) => {
    expect(siteTypeLabel(type)).toBe(label)
  })

  it('rend tel quel un type inconnu', () => {
    expect(siteTypeLabel('warehouse')).toBe('warehouse')
  })

  it('rend un tiret sans type', () => {
    expect(siteTypeLabel(undefined)).toBe('—')
  })
})

describe('siteStatusLabel', () => {
  it.each([
    ['active', 'En service'],
    ['inactive', 'Hors service'],
    ['maintenance', 'En maintenance'],
  ])('traduit %s', (status, label) => {
    expect(siteStatusLabel(status)).toBe(label)
  })
})

describe('qualityLabel', () => {
  it.each([
    ['good', 'Complète'],
    ['partial', 'Partielle'],
    ['degraded', 'Dégradée'],
    ['critical', 'Critique'],
  ] as const)('traduit %s', (quality, label) => {
    expect(qualityLabel(quality)).toBe(label)
  })

  it('explique chaque niveau', () => {
    expect(qualityHint('partial')).toBe('Un capteur en défaut : une partie des mesures manque.')
    expect(qualityHint('critical')).toBe('Perte réseau : aucune mesure reçue.')
  })
})
