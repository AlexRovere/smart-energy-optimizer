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

  function dernièreLigneStdout(): unknown {
    const appels = stdoutSpy.mock.calls
    if (appels.length === 0) return null
    return JSON.parse(appels[appels.length - 1][0] as string)
  }

  function dernièreLigneStderr(): unknown {
    const appels = stderrSpy.mock.calls
    if (appels.length === 0) return null
    return JSON.parse(appels[appels.length - 1][0] as string)
  }

  describe('niveau par défaut (info)', () => {
    it('loggue info sur stdout', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.info('démarrage', { composant: 'api' })

      expect(stdoutSpy).toHaveBeenCalledOnce()
      expect(stderrSpy).not.toHaveBeenCalled()

      const ligne = dernièreLigneStdout() as Record<string, unknown>
      expect(ligne.level).toBe('info')
      expect(ligne.message).toBe('démarrage')
      expect(ligne.composant).toBe('api')
      expect(typeof ligne.timestamp).toBe('string')
    })

    it('loggue warn sur stdout', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.warn('attention')

      expect(stdoutSpy).toHaveBeenCalledOnce()
      const ligne = dernièreLigneStdout() as Record<string, unknown>
      expect(ligne.level).toBe('warn')
    })

    it('loggue error sur stderr', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.error('erreur grave')

      expect(stderrSpy).toHaveBeenCalledOnce()
      expect(stdoutSpy).not.toHaveBeenCalled()

      const ligne = dernièreLigneStderr() as Record<string, unknown>
      expect(ligne.level).toBe('error')
      expect(ligne.message).toBe('erreur grave')
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
      const ligne = dernièreLigneStderr() as Record<string, unknown>
      expect(ligne.level).toBe('error')
      expect(ligne.route).toBe('/api/sites/SITE001/history')
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

      const ligne = dernièreLigneStdout() as Record<string, unknown>
      expect(ligne).toHaveProperty('timestamp')
      expect(ligne).toHaveProperty('level', 'info')
      expect(ligne).toHaveProperty('message', 'test format')
    })

    it('les champs de contexte sont aplatis dans la ligne', async () => {
      const { logger } = await import('../../../server/utils/logger')
      logger.info('avec contexte', { route: '/test', status: 503 })

      const ligne = dernièreLigneStdout() as Record<string, unknown>
      expect(ligne.route).toBe('/test')
      expect(ligne.status).toBe(503)
    })

    it('ne contient pas de champ email ni sessionId', async () => {
      const { logger } = await import('../../../server/utils/logger')
      // Les appelants ne doivent pas passer ces champs — on vérifie que le
      // logger ne les injecte pas lui-même
      logger.error('erreur', { route: '/api/auth/login' })

      const ligne = dernièreLigneStderr() as Record<string, unknown>
      expect(ligne).not.toHaveProperty('email')
      expect(ligne).not.toHaveProperty('sessionId')
      expect(ligne).not.toHaveProperty('password')
    })
  })
})
