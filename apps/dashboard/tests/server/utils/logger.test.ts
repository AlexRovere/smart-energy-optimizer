import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Le module est importé après avoir posé les spies pour que NUXT_LOG_LEVEL
// soit lu à l'appel (pas à l'import).

describe('logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    delete process.env.NUXT_LOG_LEVEL
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.NUXT_LOG_LEVEL
  })

  function lastStdoutLine(): unknown {
    const calls = stdoutSpy.mock.calls
    if (calls.length === 0) return null
    return JSON.parse(calls[calls.length - 1][0] as string)
  }

  function lastStderrLine(): unknown {
    const calls = stderrSpy.mock.calls
    if (calls.length === 0) return null
    return JSON.parse(calls[calls.length - 1][0] as string)
  }

  describe('niveau par défaut (info)', () => {
    it('loggue info sur stdout', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.info('démarrage', { component: 'api' })

      expect(stdoutSpy).toHaveBeenCalledOnce()
      expect(stderrSpy).not.toHaveBeenCalled()

      const row = lastStdoutLine() as Record<string, unknown>
      expect(row.level).toBe('info')
      expect(row.message).toBe('démarrage')
      expect(row.component).toBe('api')
      expect(typeof row.timestamp).toBe('string')
    })

    it('loggue warn sur stdout', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.warn('attention')

      expect(stdoutSpy).toHaveBeenCalledOnce()
      const row = lastStdoutLine() as Record<string, unknown>
      expect(row.level).toBe('warn')
    })

    it('loggue error sur stderr', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.error('erreur grave')

      expect(stderrSpy).toHaveBeenCalledOnce()
      expect(stdoutSpy).not.toHaveBeenCalled()

      const row = lastStderrLine() as Record<string, unknown>
      expect(row.level).toBe('error')
      expect(row.message).toBe('erreur grave')
    })

    it('ne loggue pas debug si le niveau est info', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.debug('détail verbeux')

      expect(stdoutSpy).not.toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
    })
  })

  describe('NUXT_LOG_LEVEL=error', () => {
    it('filtre info et warn', async () => {
      process.env.NUXT_LOG_LEVEL = 'error'
      const { logger } = await import('../../../server/utils/logger')

      logger.info('ignoré')
      logger.warn('ignoré')

      expect(stdoutSpy).not.toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
    })

    it('laisse passer error', async () => {
      process.env.NUXT_LOG_LEVEL = 'error'
      const { logger } = await import('../../../server/utils/logger')

      logger.error('erreur critique', { route: '/api/sites/SITE001/history' })

      expect(stderrSpy).toHaveBeenCalledOnce()
      const row = lastStderrLine() as Record<string, unknown>
      expect(row.level).toBe('error')
      expect(row.route).toBe('/api/sites/SITE001/history')
    })
  })

  describe('NUXT_LOG_LEVEL=debug', () => {
    it('laisse passer tous les niveaux', async () => {
      process.env.NUXT_LOG_LEVEL = 'debug'
      const { logger } = await import('../../../server/utils/logger')

      logger.error('e')
      logger.warn('w')
      logger.info('i')
      logger.debug('d')

      expect(stderrSpy).toHaveBeenCalledTimes(1)
      expect(stdoutSpy).toHaveBeenCalledTimes(3)
    })
  })

  describe('valeur inconnue', () => {
    it('replie sur info si NUXT_LOG_LEVEL est inconnu', async () => {
      process.env.NUXT_LOG_LEVEL = 'verbose'
      const { logger } = await import('../../../server/utils/logger')

      logger.info('visible')
      logger.debug('invisible')

      expect(stdoutSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('format JSON', () => {
    it('la sortie contient timestamp, level et message', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.info('test format')

      const row = lastStdoutLine() as Record<string, unknown>
      expect(row).toHaveProperty('timestamp')
      expect(row).toHaveProperty('level', 'info')
      expect(row).toHaveProperty('message', 'test format')
    })

    it('les champs de contexte sont aplatis dans la ligne', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.info('avec contexte', { route: '/test', status: 503 })

      const row = lastStdoutLine() as Record<string, unknown>
      expect(row.route).toBe('/test')
      expect(row.status).toBe(503)
    })

    it('ne contient pas de champ email ni sessionId', async () => {
      const { logger } = await import('../../../server/utils/logger')
      // Les appelants ne doivent pas passer ces champs — on vérifie que le
      // logger ne les injecte pas lui-même
      logger.error('erreur', { route: '/api/auth/login' })

      const row = lastStderrLine() as Record<string, unknown>
      expect(row).not.toHaveProperty('email')
      expect(row).not.toHaveProperty('sessionId')
      expect(row).not.toHaveProperty('password')
    })
  })
})
