const NIVEAUX = { error: 0, warn: 1, info: 2, debug: 3 } as const
type Niveau = keyof typeof NIVEAUX

function niveauActuel(): Niveau {
  const val = (process.env.NUXT_LOG_LEVEL ?? 'info').toLowerCase()
  return (val in NIVEAUX ? val : 'info') as Niveau
}

function log(niveau: Niveau, message: string, ctx?: Record<string, unknown>) {
  if (NIVEAUX[niveau] > NIVEAUX[niveauActuel()]) return
  const ligne = JSON.stringify({ timestamp: new Date().toISOString(), level: niveau, message, ...ctx })
  if (niveau === 'error') process.stderr.write(ligne + '\n')
  else process.stdout.write(ligne + '\n')
}

export const logger = {
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => log('warn',  msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => log('info',  msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
}
