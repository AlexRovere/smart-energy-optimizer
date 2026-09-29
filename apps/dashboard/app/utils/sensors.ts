import type { SensorsStatus } from '~~/shared/sensorStatusSchema'
import type { SensorFamily, SensorHealth, SensorStatus, SiteId } from '../types/api'

const FAMILIES: SensorFamily[] = ['consumption', 'electrical', 'temperature', 'humidity', 'network']
const HEALTHS = new Set<string>(['ok', 'degraded', 'critical'])

// L'API Mock écrit ses fins de panne sans fuseau, en UTC : lues telles quelles,
// le navigateur les prendrait pour de l'heure locale.
function asUtc(value: string | null): string | null {
  if (!value) return null
  const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
  const time = Date.parse(withZone)
  return Number.isNaN(time) ? value : new Date(time).toISOString()
}

// Un état global inconnu de la source n'est pas un feu vert : il passe en
// dégradé, pour attirer l'œil plutôt que rassurer à tort.
export function normalizeSensors(raw: SensorsStatus | null | undefined): SensorStatus[] {
  if (!raw) return []
  return Object.entries(raw).map(([siteId, site]) => ({
    site_id: siteId as SiteId,
    site_name: site.site_name,
    overall: (HEALTHS.has(site.overall) ? site.overall : 'degraded') as SensorHealth,
    sensors: FAMILIES
      .filter(family => site.sensors[family])
      .map(family => ({
        family,
        status: site.sensors[family]!.status as SensorStatus['sensors'][number]['status'],
        failing_until: asUtc(site.sensors[family]!.failing_until),
      })),
  }))
}
