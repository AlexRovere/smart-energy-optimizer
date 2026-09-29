import { MAX_RANGE_DAYS } from '~~/shared/historyRange'

export { MAX_RANGE_DAYS }

const DAY_MS = 86_400_000

export interface HistoryRange {
  from: string
  to: string
}

function localMidnight(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

// Les dates choisies sont des journées locales, fin comprise : du 1er au 15,
// c'est jusqu'au 16 à minuit.
export function customRange(start: string, end: string): HistoryRange {
  const to = localMidnight(end)
  to.setDate(to.getDate() + 1)
  return { from: localMidnight(start).toISOString(), to: to.toISOString() }
}

// Mêmes refus que la route, pour les dire avant d'appeler le serveur.
export function rangeError(start: string, end: string): string | null {
  if (!start || !end) return 'Choisir une date de début et une date de fin'
  const { from, to } = customRange(start, end)
  const span = Date.parse(to) - Date.parse(from)
  if (span <= 0) return 'La fin de la plage doit suivre son début'
  if (span > MAX_RANGE_DAYS * DAY_MS + 3_600_000) return `Plage trop longue : ${MAX_RANGE_DAYS} jours au plus`
  return null
}
