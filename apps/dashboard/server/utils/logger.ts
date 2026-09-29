const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const
type Level = keyof typeof LEVELS

function currentLevel(): Level {
  const val = (process.env.NUXT_LOG_LEVEL ?? 'info').toLowerCase()
  return (val in LEVELS ? val : 'info') as Level
}

function log(level: Level, message: string, ctx?: Record<string, unknown>) {
  if (LEVELS[level] > LEVELS[currentLevel()]) return
  const row = JSON.stringify({ timestamp: new Date().toISOString(), level: level, message, ...ctx })
  if (level === 'error') process.stderr.write(row + '\n')
  else process.stdout.write(row + '\n')
}

export const logger = {
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => log('warn',  msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => log('info',  msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
}
