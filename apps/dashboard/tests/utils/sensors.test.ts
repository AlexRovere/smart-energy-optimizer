import { describe, expect, it } from 'vitest'
import { normalizeSensors } from '../../app/utils/sensors'
import { healthLabel, sensorFamilyLabel, sensorStateLabel } from '../../app/utils/labels'

const ok = { status: 'ok', failing_until: null }

describe('normalizeSensors', () => {
  it('passe du dictionnaire par site à une liste, familles dans un ordre fixe', () => {
    const result = normalizeSensors({
      SITE002: {
        site_name: 'Usine Lyon',
        overall: 'degraded',
        sensors: { network: ok, humidity: { status: 'failing', failing_until: '2026-09-29T08:07:46' }, consumption: ok, electrical: ok, temperature: ok },
      },
    })

    expect(result).toEqual([{
      site_id: 'SITE002',
      site_name: 'Usine Lyon',
      overall: 'degraded',
      sensors: [
        { family: 'consumption', status: 'ok', failing_until: null },
        { family: 'electrical', status: 'ok', failing_until: null },
        { family: 'temperature', status: 'ok', failing_until: null },
        { family: 'humidity', status: 'failing', failing_until: '2026-09-29T08:07:46.000Z' },
        { family: 'network', status: 'ok', failing_until: null },
      ],
    }])
  })

  it('range un état global inconnu en dégradé plutôt que de le dire sain', () => {
    const [site] = normalizeSensors({ SITE001: { site_name: 'Bureau', overall: 'rebooting', sensors: {} } })
    expect(site?.overall).toBe('degraded')
  })

  it("lit une fin de panne sans fuseau comme de l'UTC, ainsi que l'écrit la source", () => {
    const [site] = normalizeSensors({
      SITE001: { site_name: 'Bureau', overall: 'degraded', sensors: { humidity: { status: 'failing', failing_until: '2026-09-29T14:49:41.834597' } } },
    })
    expect(site?.sensors[0]?.failing_until).toBe('2026-09-29T14:49:41.834Z')
  })

  it('garde une fin de panne qui porte déjà son fuseau', () => {
    const [site] = normalizeSensors({
      SITE001: { site_name: 'Bureau', overall: 'degraded', sensors: { humidity: { status: 'failing', failing_until: '2026-09-29T16:49:41+02:00' } } },
    })
    expect(site?.sensors[0]?.failing_until).toBe('2026-09-29T14:49:41.000Z')
  })

  it('rend une liste vide sans données', () => {
    expect(normalizeSensors(null)).toEqual([])
  })
})

describe('libellés des capteurs', () => {
  it.each([
    ['consumption', 'Consommation'],
    ['electrical', 'Électrique'],
    ['temperature', 'Température'],
    ['humidity', 'Humidité'],
    ['network', 'Réseau'],
  ])('famille %s', (family, label) => {
    expect(sensorFamilyLabel(family)).toBe(label)
  })

  it.each([
    ['ok', 'En service'],
    ['failing', 'En panne'],
    ['degraded', 'Dégradé'],
    ['critical', 'Critique'],
  ])('état %s', (state, label) => {
    expect(sensorStateLabel(state)).toBe(label)
  })

  it.each([
    ['ok', 'Sain'],
    ['degraded', 'Dégradé'],
    ['critical', 'Critique'],
  ])('santé %s', (health, label) => {
    expect(healthLabel(health)).toBe(label)
  })
})
