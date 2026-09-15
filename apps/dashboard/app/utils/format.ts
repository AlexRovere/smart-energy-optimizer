export function fmtNum(v: number | null | undefined, fallback = '--'): string {
  return v == null ? fallback : v.toLocaleString('fr-FR')
}

export function fmtPct(v: number | null | undefined, fallback = '--'): string {
  return v == null ? fallback : `${Math.round(v)}`
}
