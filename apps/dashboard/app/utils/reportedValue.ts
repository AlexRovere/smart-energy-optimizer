interface HistoryPoint {
  timestamp: string
  consumption_kw: number | null
  consumption_kw_corrected?: number | null
}

// Quand un capteur tombe, afficher « — » laisse l'exploitant sans repère. On
// reporte la dernière valeur connue de l'historique (corrigée par l'ETL quand
// elle existe), en disant de quand elle date : `reportedAt` non nul.
export function displayedConsumption(
  current: { consumption_kw: number | null } | null | undefined,
  history: HistoryPoint[],
): { kw: number; reportedAt: string | null } | null {
  if (current?.consumption_kw != null) return { kw: current.consumption_kw, reportedAt: null }
  for (let i = history.length - 1; i >= 0; i--) {
    const point = history[i]!
    const kw = point.consumption_kw_corrected ?? point.consumption_kw
    if (kw != null) return { kw, reportedAt: point.timestamp }
  }
  return null
}
