export function fmtNum(v: number | null | undefined, fallback = '--'): string {
  return v == null ? fallback : v.toLocaleString('fr-FR')
}

export function fmtPct(v: number | null | undefined, fallback = '--'): string {
  return v == null ? fallback : `${Math.round(v)}`
}

// « 29/09 13:00 » : assez pour juger de la fraîcheur d'une donnée.
export function fmtShortDateTime(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) return fallback
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
